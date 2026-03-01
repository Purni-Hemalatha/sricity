import json
import re

from django.http import HttpRequest, JsonResponse
from django.views import View
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import uuid
import os

from .auth import (
    ExternalAuthError,
    create_signed_otp_challenge,
    create_signed_session,
    is_success_response,
    load_signed_otp_challenge,
    load_signed_session,
    post_form_json,
    require_env,
)
from .models import Employee, BankDetail, ComplianceID, CTCHistory, OnboardingChecklist
from .serializers import EmployeeSerializer, EmployeeProfileSerializer, BankDetailSerializer, ComplianceIDSerializer, CTCHistorySerializer, OnboardingChecklistSerializer

SYSTEM_NAME = 'isl'
REGISTER_ROLE = 'isl_user'


def _normalize_phone(raw: str) -> str:
    return re.sub(r'\D+', '', (raw or '').strip())


def _get_bearer_token(request: HttpRequest) -> str | None:
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None

    prefix = 'Bearer '
    if not auth_header.startswith(prefix):
        return None

    token = auth_header[len(prefix) :].strip()
    return token or None


def _get_session_payload(request: HttpRequest) -> dict | None:
    token = _get_bearer_token(request)
    if not token:
        return None
    try:
        return load_signed_session(token)
    except ExternalAuthError:
        return None


def _json_body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise ValueError(f'Invalid JSON: {str(e)}')


def _external_error_message(result: dict, default: str) -> str:
    return result.get('error') or result.get('message') or default


def _external_success_message(result: dict) -> str | None:
    message = (result.get('message') or result.get('status') or '').strip()
    return message or None


def _post_external_or_error(
    *,
    url_env: str,
    payload: dict[str, str],
    failure_status: int,
    failure_default_message: str,
) -> tuple[dict | None, JsonResponse | None]:
    try:
        url = require_env(url_env)
    except ExternalAuthError as exc:
        return None, JsonResponse({'error': str(exc)}, status=500)

    try:
        result = post_form_json(url=url, payload=payload)
    except ExternalAuthError as exc:
        return None, JsonResponse({'error': str(exc)}, status=502)

    if not is_success_response(result):
        message = _external_error_message(result, failure_default_message)
        return None, JsonResponse({'error': message}, status=failure_status)

    return result, None


class HealthView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        return JsonResponse({'status': 'ok'})


class ApiLoginView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        username_raw = (payload.get('username') or '').strip()
        password = (payload.get('password') or '').strip()

        if not username_raw or not password:
            return JsonResponse({'error': 'Please enter username and password.'}, status=400)

        result, error = _post_external_or_error(
            url_env='LOGIN_THROUGH_PASSWORD_URL',
            payload={
                'email': username_raw,
                'password': password,
                'system_name': SYSTEM_NAME,
            },
            failure_status=401,
            failure_default_message='Invalid username or password.',
        )
        if error:
            return error

        session_payload = {'email': username_raw}
        session_payload.update(result or {})
        raw_token, expires_at = create_signed_session(payload=session_payload)

        return JsonResponse(
            {
                'token': raw_token,
                'expires_at': expires_at.isoformat(),
                'user': {
                    'id': None,
                    'username': username_raw,
                },
            }
        )


class ApiForgotPasswordView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        email = (payload.get('email') or '').strip()
        password = (payload.get('password') or '').strip()

        if not email or not password:
            return JsonResponse({'error': 'Please enter email and password.'}, status=400)

        result, error = _post_external_or_error(
            url_env='FORGET_PASSWORD_URL',
            payload={
                'email': email,
                'password': password,
                'system_name': SYSTEM_NAME,
            },
            failure_status=400,
            failure_default_message='Unable to reset password.',
        )
        if error:
            return error

        return JsonResponse({'ok': True, 'message': _external_success_message(result or {})})


class ApiRegisterView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        display_name = (payload.get('display_name') or '').strip()
        email = (payload.get('email') or '').strip()
        phone_number = _normalize_phone(payload.get('phone_number') or '')
        password = (payload.get('password') or '').strip()

        if not display_name or not email or not phone_number or not password:
            return JsonResponse({'error': 'Please fill all required fields.'}, status=400)

        result, error = _post_external_or_error(
            url_env='REGISTER_URL',
            payload={
                'display_name': display_name,
                'email': email,
                'phone_number': phone_number,
                'password': password,
                'system_name': SYSTEM_NAME,
                'role': REGISTER_ROLE,
            },
            failure_status=400,
            failure_default_message='Unable to create account.',
        )
        if error:
            return error

        return JsonResponse({'ok': True, 'message': _external_success_message(result or {})})


class ApiMeView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        session_payload = _get_session_payload(request)
        if session_payload is None:
            return JsonResponse({'error': 'Unauthorized'}, status=401)

        email = (session_payload.get('email') or '').strip() or None

        return JsonResponse(
            {
                'user': {
                    'id': None,
                    'username': email,
                },
                'member': {
                    'id': None,
                    'name': session_payload.get('display_name'),
                    'email': email,
                    'phone': session_payload.get('phone_number'),
                },
            }
        )


class ApiLogoutView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        return JsonResponse({'ok': True})


class ApiOtpRequestView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        channel = (payload.get('channel') or '').strip().lower()
        phone = _normalize_phone(payload.get('phone') or payload.get('username') or '')
        email = (payload.get('email') or payload.get('username') or '').strip()

        if channel not in {'whatsapp', 'email'}:
            return JsonResponse({'error': 'Invalid OTP channel.'}, status=400)

        if channel == 'whatsapp' and not phone:
            return JsonResponse({'error': 'Please enter mobile number.'}, status=400)
        if channel == 'email' and not email:
            return JsonResponse({'error': 'Please enter email id.'}, status=400)

        identifier = email if channel == 'email' else phone
        result, error = _post_external_or_error(
            url_env='SEND_OTP_URL',
            payload={
                'email': identifier,
                'type': channel,
                'system_name': SYSTEM_NAME,
            },
            failure_status=400,
            failure_default_message='Unable to request key',
        )
        if error:
            return error

        challenge_id, expires_at = create_signed_otp_challenge(email=identifier, channel=channel)
        return JsonResponse({'challenge_id': challenge_id, 'expires_at': expires_at.isoformat()})


class ApiOtpVerifyView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        challenge_id = payload.get('challenge_id')
        otp = (payload.get('otp') or '').strip()

        if not challenge_id or not otp:
            return JsonResponse({'error': 'Please enter OTP.'}, status=400)

        try:
            otp_payload = load_signed_otp_challenge(str(challenge_id))
        except ExternalAuthError as exc:
            return JsonResponse({'error': str(exc)}, status=401)

        email = (otp_payload.get('email') or '').strip()
        result, error = _post_external_or_error(
            url_env='VERIFY_OTP_URL',
            payload={
                'email': email,
                'otp': otp,
                'system_name': SYSTEM_NAME,
            },
            failure_status=401,
            failure_default_message='Invalid or expired OTP.',
        )
        if error:
            return error

        session_payload = {'email': email}
        session_payload.update(result or {})
        raw_token, expires_at = create_signed_session(payload=session_payload)

        return JsonResponse(
            {
                'token': raw_token,
                'expires_at': expires_at.isoformat(),
                'user': {'id': None, 'username': email},
            }
        )


# Employee CRUD Views
class EmployeeListCreateView(View):
    """GET list all employees, POST create new employee"""
    
    def get(self, request: HttpRequest) -> JsonResponse:
        try:
            employees = Employee.objects.all().order_by('-created_at')
            employees_data = []
            for emp in employees:
                emp_dict = {
                    'id': emp.id,
                    'emp_id': emp.emp_id,
                    'first_name': emp.first_name,
                    'last_name': emp.last_name,
                    'email': emp.email,
                    'phone': emp.phone,
                    'department': emp.department,
                    'designation': emp.designation,
                    'joining_date': emp.joining_date.isoformat() if emp.joining_date else None,
                    'exit_date': emp.exit_date.isoformat() if emp.exit_date else None,
                    'status': emp.status,
                    'created_at': emp.created_at.isoformat() if emp.created_at else None,
                    'updated_at': emp.updated_at.isoformat() if emp.updated_at else None,
                }
                employees_data.append(emp_dict)
            return JsonResponse(employees_data, safe=False)
        except Exception as e:
            return JsonResponse({'error': f'Error fetching employees: {str(e)}'}, status=500)
    
    def post(self, request: HttpRequest) -> JsonResponse:
        try:
            payload = _json_body(request)
            
            if not payload:
                return JsonResponse({'error': 'Request body is empty'}, status=400)
            
            # Validate required fields
            required_fields = ['emp_id', 'first_name', 'last_name', 'email', 'joining_date']
            missing_fields = [f for f in required_fields if not payload.get(f)]
            if missing_fields:
                return JsonResponse({'error': f'Missing required fields: {", ".join(missing_fields)}'}, status=400)
            
            # Check unique emp_id
            if Employee.objects.filter(emp_id=payload.get('emp_id')).exists():
                return JsonResponse({'error': 'Employee ID already exists'}, status=400)
            
            serializer = EmployeeSerializer(data=payload)
            if serializer.is_valid():
                employee = serializer.save()
                emp_dict = {
                    'id': employee.id,
                    'emp_id': employee.emp_id,
                    'first_name': employee.first_name,
                    'last_name': employee.last_name,
                    'email': employee.email,
                    'phone': employee.phone,
                    'department': employee.department,
                    'designation': employee.designation,
                    'joining_date': employee.joining_date.isoformat() if employee.joining_date else None,
                    'exit_date': employee.exit_date.isoformat() if employee.exit_date else None,
                    'status': employee.status,
                    'created_at': employee.created_at.isoformat() if employee.created_at else None,
                    'updated_at': employee.updated_at.isoformat() if employee.updated_at else None,
                }
                return JsonResponse(emp_dict, status=201)
            # Return detailed serializer errors
            errors_str = '; '.join([f"{field}: {', '.join(err) if isinstance(err, list) else err}" for field, err in serializer.errors.items()])
            return JsonResponse({'error': f'Validation failed: {errors_str}'}, status=400)
        except ValueError as e:
            return JsonResponse({'error': f'JSON parsing error: {str(e)}'}, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': f'Error creating employee: {str(e)}'}, status=500)



class EmployeeDetailView(View):
    """GET, PUT single employee"""
    
    def get(self, request: HttpRequest, pk: int) -> JsonResponse:
        try:
            employee = get_object_or_404(Employee, pk=pk)
            emp_dict = {
                'id': employee.id,
                'emp_id': employee.emp_id,
                'first_name': employee.first_name,
                'last_name': employee.last_name,
                'email': employee.email,
                'phone': employee.phone,
                'department': employee.department,
                'designation': employee.designation,
                'joining_date': employee.joining_date.isoformat() if employee.joining_date else None,
                'exit_date': employee.exit_date.isoformat() if employee.exit_date else None,
                'status': employee.status,
                'created_at': employee.created_at.isoformat() if employee.created_at else None,
                'updated_at': employee.updated_at.isoformat() if employee.updated_at else None,
            }
            return JsonResponse(emp_dict)
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Employee not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': f'Error fetching employee: {str(e)}'}, status=500)
    
    def put(self, request: HttpRequest, pk: int) -> JsonResponse:
        try:
            employee = get_object_or_404(Employee, pk=pk)
            payload = _json_body(request)
            
            if not payload:
                return JsonResponse({'error': 'Request body is empty'}, status=400)
            
            serializer = EmployeeSerializer(employee, data=payload, partial=True)
            if serializer.is_valid():
                serializer.save()
                emp_dict = {
                    'id': employee.id,
                    'emp_id': employee.emp_id,
                    'first_name': employee.first_name,
                    'last_name': employee.last_name,
                    'email': employee.email,
                    'phone': employee.phone,
                    'department': employee.department,
                    'designation': employee.designation,
                    'joining_date': employee.joining_date.isoformat() if employee.joining_date else None,
                    'exit_date': employee.exit_date.isoformat() if employee.exit_date else None,
                    'status': employee.status,
                    'created_at': employee.created_at.isoformat() if employee.created_at else None,
                    'updated_at': employee.updated_at.isoformat() if employee.updated_at else None,
                }
                return JsonResponse(emp_dict)
            return JsonResponse({'error': serializer.errors}, status=400)
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Employee not found'}, status=404)
        except ValueError as e:
            return JsonResponse({'error': f'JSON parsing error: {str(e)}'}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'Error updating employee: {str(e)}'}, status=500)


class EmployeeExitView(View):
    """POST to exit/deactivate employee"""
    
    def post(self, request: HttpRequest, pk: int) -> JsonResponse:
        try:
            from datetime import datetime
            employee = get_object_or_404(Employee, pk=pk)
            payload = _json_body(request)
            exit_date_str = payload.get('exit_date')
            
            if not exit_date_str:
                return JsonResponse({'error': 'Exit date is required'}, status=400)
            
            # Parse exit_date string to date object
            if isinstance(exit_date_str, str):
                try:
                    exit_date_obj = datetime.strptime(exit_date_str, '%Y-%m-%d').date()
                except ValueError:
                    return JsonResponse({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)
            else:
                exit_date_obj = exit_date_str
            
            employee.exit_date = exit_date_obj
            employee.status = 'EXITED'
            employee.save()
            
            emp_dict = {
                'id': employee.id,
                'emp_id': employee.emp_id,
                'first_name': employee.first_name,
                'last_name': employee.last_name,
                'email': employee.email,
                'phone': employee.phone,
                'department': employee.department,
                'designation': employee.designation,
                'joining_date': employee.joining_date.isoformat() if employee.joining_date else None,
                'exit_date': employee.exit_date.isoformat() if employee.exit_date else None,
                'status': employee.status,
                'created_at': employee.created_at.isoformat() if employee.created_at else None,
                'updated_at': employee.updated_at.isoformat() if employee.updated_at else None,
            }
            return JsonResponse(emp_dict)
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Employee not found'}, status=404)
        except ValueError as e:
            return JsonResponse({'error': f'JSON parsing error: {str(e)}'}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'Error exiting employee: {str(e)}'}, status=500)


class EmployeeProfileView(View):
    """Unified employee profile combining master details, bank, compliance, and CTC history"""
    
    def get(self, request: HttpRequest, employee_id: int = None) -> JsonResponse:
        """
        Retrieve complete employee profile with all related data.
        
        GET /api/employee-profile/{employee_id}
        Returns: Employee master + bank details + compliance IDs + CTC history
        """
        try:
            if not employee_id:
                return JsonResponse({'error': 'Employee ID is required'}, status=400)
            
            employee = get_object_or_404(Employee, id=employee_id)
            serializer = EmployeeProfileSerializer(employee)
            
            return JsonResponse(serializer.data)
        
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Employee not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': f'Error retrieving profile: {str(e)}'}, status=500)


class EmployeeProfileByEmpIdView(View):
    """Unified employee profile by employee ID (emp_id) instead of database ID"""
    
    def get(self, request: HttpRequest, emp_id: str = None) -> JsonResponse:
        """
        Retrieve complete employee profile using emp_id.
        
        GET /api/employee-profile-by-id/{emp_id}
        """
        try:
            if not emp_id:
                return JsonResponse({'error': 'Employee ID is required'}, status=400)
            
            employee = get_object_or_404(Employee, emp_id=emp_id)
            serializer = EmployeeProfileSerializer(employee)
            
            return JsonResponse(serializer.data)
        
        except Employee.DoesNotExist:
            return JsonResponse({'error': f'Employee {emp_id} not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': f'Error retrieving profile: {str(e)}'}, status=500)


class EmployeeProfileCTCTimelineView(View):
    """Get CTC history timeline for an employee"""
    
    def get(self, request: HttpRequest, employee_id: int = None) -> JsonResponse:
        """
        Retrieve CTC history timeline.
        
        GET /api/employee-profile/{employee_id}/ctc-timeline
        """
        try:
            if not employee_id:
                return JsonResponse({'error': 'Employee ID is required'}, status=400)
            
            employee = get_object_or_404(Employee, id=employee_id)
            from .serializers import CTCHistorySerializer
            
            ctc_records = employee.ctc_history.all()
            serializer = CTCHistorySerializer(ctc_records, many=True)
            
            return JsonResponse({
                'employee_id': employee.id,
                'emp_id': employee.emp_id,
                'employee_name': f"{employee.first_name} {employee.last_name}",
                'ctc_timeline': serializer.data,
                'current_ctc': serializer.data[0] if serializer.data else None,
                'total_records': len(serializer.data)
            })
        
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Employee not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': f'Error retrieving CTC timeline: {str(e)}'}, status=500)


class ApiTestExternalAuthView(View):
    """Test endpoint to verify external auth service connectivity"""
    def get(self, request: HttpRequest) -> JsonResponse:
        results = {}
        
        # Test each external auth endpoint
        endpoints = {
            'LOGIN_THROUGH_PASSWORD_URL': 'Login',
            'REGISTER_URL': 'Register',
            'SEND_OTP_URL': 'Send OTP',
            'VERIFY_OTP_URL': 'Verify OTP',
            'FORGET_PASSWORD_URL': 'Forgot Password'
        }
        
        for env_var, label in endpoints.items():
            try:
                url = require_env(env_var)
                # Try to reach the endpoint
                import urllib.request
                req = urllib.request.Request(url, data=b'', method='POST')
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                try:
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        status = resp.getcode()
                        results[label] = {'status': 'reachable', 'code': status}
                except urllib.error.HTTPError as e:
                    results[label] = {'status': 'error', 'code': e.code, 'message': str(e)}
                except urllib.error.URLError as e:
                    results[label] = {'status': 'unreachable', 'message': str(e)}
            except ExternalAuthError as e:
                results[label] = {'status': 'config_error', 'message': str(e)}
        
        return JsonResponse(results)


# ═══════════════════════════════════════════════════════════════════════════════
#  TEAM38 DATABASE VIEWS
#  Targets the original team38 schema tables:
#    emp_master, emp_bank_info, emp_ctc_info,
#    emp_compliance_tracker, emp_reg_info
# ═══════════════════════════════════════════════════════════════════════════════

def _rows_as_dicts(cursor) -> list[dict]:
    """Convert cursor rows to list of dicts using column names."""
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def _row_as_dict(cursor) -> dict | None:
    cols = [d[0] for d in cursor.description]
    row  = cursor.fetchone()
    return dict(zip(cols, row)) if row else None


def _serialize_row(row: dict) -> dict:
    """Convert date/decimal objects to JSON-safe strings."""
    import datetime
    from decimal import Decimal
    out = {}
    for k, v in row.items():
        if isinstance(v, (datetime.date, datetime.datetime)):
            out[k] = v.isoformat()
        elif isinstance(v, Decimal):
            out[k] = float(v)
        else:
            out[k] = v
    return out


def _serialize_rows(rows: list[dict]) -> list[dict]:
    return [_serialize_row(r) for r in rows]


# ─── emp_master CRUD  ────────────────────────────────────────────────────────
class EmpMasterView(View):
    """
    GET  /api/team38/emp-master           → list all rows from emp_master
    POST /api/team38/emp-master           → insert a new row into emp_master

    Table: emp_master
    Columns (exact):
      emp_id (PK, int unsigned, auto)
      first_name  varchar(50)  NOT NULL
      middle_name varchar(50)  NULLABLE
      last_name   varchar(50)  NOT NULL
      start_date  date         NOT NULL
      end_date    date         NULLABLE  (NULL = still employed / ACTIVE)
    """

    def get(self, request: HttpRequest) -> JsonResponse:
        from django.db import connection
        try:
            search     = (request.GET.get('search') or '').strip()
            status_f   = (request.GET.get('status') or 'ALL').strip().upper()
            sort_by    = (request.GET.get('sort')   or 'emp_id').strip()

            sql = """
                SELECT
                    emp_id, first_name, middle_name, last_name,
                    start_date, end_date,
                    CASE WHEN end_date IS NULL THEN 'ACTIVE' ELSE 'EXITED' END AS status
                FROM emp_master
            """
            params = []
            conditions = []

            if search:
                conditions.append(
                    "(first_name LIKE %s OR middle_name LIKE %s "
                    " OR last_name LIKE %s OR CAST(emp_id AS CHAR) LIKE %s)"
                )
                like = f'%{search}%'
                params.extend([like, like, like, like])

            if status_f == 'ACTIVE':
                conditions.append('end_date IS NULL')
            elif status_f == 'EXITED':
                conditions.append('end_date IS NOT NULL')

            if conditions:
                sql += ' WHERE ' + ' AND '.join(conditions)

            order_map = {
                'emp_id':     'emp_id',
                'name':       'first_name, last_name',
                'start_date': 'start_date DESC',
            }
            sql += ' ORDER BY ' + order_map.get(sort_by, 'emp_id')

            with connection.cursor() as c:
                c.execute(sql, params)
                rows = _rows_as_dicts(c)

            return JsonResponse(_serialize_rows(rows), safe=False)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request: HttpRequest) -> JsonResponse:
        """INSERT a new employee into emp_master."""
        from django.db import connection
        try:
            payload    = _json_body(request)
            first_name  = (payload.get('first_name')  or '').strip()
            middle_name = (payload.get('middle_name') or None)
            last_name   = (payload.get('last_name')   or '').strip()
            start_date  = (payload.get('start_date')  or '').strip()
            end_date    = payload.get('end_date') or None

            if not first_name or not last_name or not start_date:
                return JsonResponse(
                    {'error': 'first_name, last_name, start_date are required'}, status=400
                )

            with connection.cursor() as c:
                c.execute(
                    '''INSERT INTO emp_master
                       (first_name, middle_name, last_name, start_date, end_date)
                       VALUES (%s, %s, %s, %s, %s)''',
                    [first_name, middle_name or None, last_name, start_date, end_date]
                )
                new_id = c.lastrowid
                c.execute(
                    """SELECT emp_id, first_name, middle_name, last_name,
                              start_date, end_date,
                              CASE WHEN end_date IS NULL THEN 'ACTIVE' ELSE 'EXITED' END AS status
                       FROM emp_master WHERE emp_id = %s""",
                    [new_id]
                )
                row = _row_as_dict(c)

            return JsonResponse(_serialize_row(row), status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmpMasterDetailView(View):
    """
    GET    /api/team38/emp-master/<emp_id>  → single employee
    PUT    /api/team38/emp-master/<emp_id>  → update employee
    DELETE /api/team38/emp-master/<emp_id>  → delete employee
    """

    def _get_row(self, cursor, emp_id):
        cursor.execute(
            """SELECT emp_id, first_name, middle_name, last_name,
                      start_date, end_date,
                      CASE WHEN end_date IS NULL THEN 'ACTIVE' ELSE 'EXITED' END AS status
               FROM emp_master WHERE emp_id = %s""",
            [emp_id]
        )
        return _row_as_dict(cursor)

    def get(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                row = self._get_row(c, emp_id)
            if not row:
                return JsonResponse({'error': 'Not found'}, status=404)
            return JsonResponse(_serialize_row(row))
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def put(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            payload    = _json_body(request)
            first_name  = (payload.get('first_name')  or '').strip()
            middle_name = payload.get('middle_name') or None
            last_name   = (payload.get('last_name')   or '').strip()
            start_date  = (payload.get('start_date')  or '').strip()
            end_date    = payload.get('end_date') or None

            if not first_name or not last_name or not start_date:
                return JsonResponse(
                    {'error': 'first_name, last_name, start_date are required'}, status=400
                )

            with connection.cursor() as c:
                c.execute(
                    '''UPDATE emp_master
                       SET first_name=%s, middle_name=%s, last_name=%s,
                           start_date=%s, end_date=%s
                       WHERE emp_id=%s''',
                    [first_name, middle_name, last_name, start_date, end_date, emp_id]
                )
                if c.rowcount == 0:
                    return JsonResponse({'error': 'Not found'}, status=404)
                row = self._get_row(c, emp_id)

            return JsonResponse(_serialize_row(row))
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def delete(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                c.execute('DELETE FROM emp_master WHERE emp_id = %s', [emp_id])
                if c.rowcount == 0:
                    return JsonResponse({'error': 'Not found'}, status=404)
            return JsonResponse({'deleted': emp_id})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmpMasterExitView(View):
    """
    POST /api/team38/emp-master/<emp_id>/exit
    Body: { "end_date": "YYYY-MM-DD" }
    Sets end_date → marks employee as EXITED.
    """

    def post(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            payload  = _json_body(request)
            end_date = (payload.get('end_date') or '').strip()
            if not end_date:
                return JsonResponse({'error': 'end_date is required'}, status=400)

            with connection.cursor() as c:
                c.execute(
                    'UPDATE emp_master SET end_date=%s WHERE emp_id=%s',
                    [end_date, emp_id]
                )
                if c.rowcount == 0:
                    return JsonResponse({'error': 'Not found'}, status=404)
                # return updated row
                c.execute(
                    """SELECT emp_id, first_name, middle_name, last_name,
                              start_date, end_date,
                              CASE WHEN end_date IS NULL THEN 'ACTIVE' ELSE 'EXITED' END AS status
                       FROM emp_master WHERE emp_id = %s""",
                    [emp_id]
                )
                row = _row_as_dict(c)

            return JsonResponse(_serialize_row(row))
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ─── Team38EmployeeListView  ─────────────────────────────────────────────────
class Team38EmployeeListView(View):
    """
    GET /api/team38/employees

    Returns ALL employees from emp_master with joined data from:
      emp_bank_info, emp_ctc_info (latest record), emp_reg_info,
      emp_compliance_tracker (count)

    Each record shape:
      emp_master columns + bank_* + reg_* + latest_ctc_* + compliance_count
    """

    def get(self, request: HttpRequest) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                c.execute("""
                    SELECT
                        m.emp_id,
                        m.first_name,
                        m.middle_name,
                        m.last_name,
                        m.start_date,
                        m.end_date,
                        -- Status derived from end_date
                        CASE WHEN m.end_date IS NULL THEN 'ACTIVE' ELSE 'EXITED' END AS status,
                        -- Bank info
                        b.emp_bank_id,
                        b.bank_acct_no,
                        b.ifsc_code,
                        b.branch_name,
                        b.bank_name,
                        -- Registration info
                        r.pan,
                        r.aadhaar,
                        r.uan_epf_acctno,
                        r.esi,
                        -- Latest CTC
                        ctc.int_title  AS ctc_int_title,
                        ctc.ext_title  AS ctc_ext_title,
                        ctc.main_level AS ctc_main_level,
                        ctc.sub_level  AS ctc_sub_level,
                        ctc.ctc_amt    AS ctc_amt,
                        ctc.start_of_ctc AS ctc_start_of_ctc,
                        ctc.end_of_ctc   AS ctc_end_of_ctc,
                        -- Compliance summary
                        (SELECT COUNT(*) FROM emp_compliance_tracker ct WHERE ct.emp_id = m.emp_id)
                            AS compliance_count
                    FROM emp_master m
                    LEFT JOIN emp_bank_info b ON b.emp_id = m.emp_id
                    LEFT JOIN emp_reg_info  r ON r.emp_id = m.emp_id
                    LEFT JOIN emp_ctc_info  ctc ON ctc.emp_ctc_id = (
                        SELECT emp_ctc_id FROM emp_ctc_info
                        WHERE emp_id = m.emp_id
                        ORDER BY start_of_ctc DESC
                        LIMIT 1
                    )
                    ORDER BY m.emp_id
                """)
                rows = _rows_as_dicts(c)

            return JsonResponse(_serialize_rows(rows), safe=False)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ─── Team38ProfileView  ──────────────────────────────────────────────────────
class Team38ProfileView(View):
    """
    GET /api/team38/profile/<emp_id>

    Returns the full profile from team38 tables:
      emp_master, emp_bank_info, emp_ctc_info,
      emp_compliance_tracker, emp_reg_info
    """

    def get(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                # emp_master
                c.execute(
                    'SELECT * FROM emp_master WHERE emp_id = %s', [emp_id]
                )
                master = _row_as_dict(c)
                if not master:
                    return JsonResponse({'error': 'Employee not found'}, status=404)

                # emp_bank_info
                c.execute(
                    'SELECT * FROM emp_bank_info WHERE emp_id = %s', [emp_id]
                )
                bank = _row_as_dict(c)

                # emp_ctc_info  (ordered newest first)
                c.execute(
                    'SELECT * FROM emp_ctc_info WHERE emp_id = %s ORDER BY start_of_ctc DESC',
                    [emp_id]
                )
                ctc_list = _rows_as_dicts(c)

                # emp_compliance_tracker
                c.execute(
                    'SELECT * FROM emp_compliance_tracker WHERE emp_id = %s', [emp_id]
                )
                compliance_list = _rows_as_dicts(c)

                # emp_reg_info
                c.execute(
                    'SELECT * FROM emp_reg_info WHERE emp_id = %s', [emp_id]
                )
                reg = _row_as_dict(c)

            return JsonResponse({
                'emp_master':             _serialize_row(master),
                'emp_bank_info':          _serialize_row(bank)   if bank else None,
                'emp_ctc_info':           _serialize_rows(ctc_list),
                'emp_compliance_tracker': _serialize_rows(compliance_list),
                'emp_reg_info':           _serialize_row(reg)    if reg else None,
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ─── emp_bank_info  ──────────────────────────────────────────────────────────
class EmpBankInfoView(View):
    """
    GET  /api/team38/<emp_id>/bank-info
    POST /api/team38/<emp_id>/bank-info

    Table: emp_bank_info
    Columns: emp_id, bank_acct_no, ifsc_code, branch_name, bank_name
    """

    def get(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                c.execute('SELECT * FROM emp_bank_info WHERE emp_id = %s', [emp_id])
                row = _row_as_dict(c)
            return JsonResponse(_serialize_row(row) if row else {})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            payload = _json_body(request)
            bank_acct_no = (payload.get('bank_acct_no') or '').strip()
            ifsc_code    = (payload.get('ifsc_code')    or '').strip().upper()
            branch_name  = (payload.get('branch_name')  or '').strip()
            bank_name    = (payload.get('bank_name')    or '').strip()

            if not bank_acct_no or not ifsc_code or not bank_name:
                return JsonResponse(
                    {'error': 'bank_acct_no, ifsc_code, bank_name are required'}, status=400
                )

            with connection.cursor() as c:
                c.execute('SELECT emp_bank_id FROM emp_bank_info WHERE emp_id = %s', [emp_id])
                existing = c.fetchone()
                if existing:
                    c.execute(
                        '''UPDATE emp_bank_info
                           SET bank_acct_no=%s, ifsc_code=%s, branch_name=%s, bank_name=%s
                           WHERE emp_id=%s''',
                        [bank_acct_no, ifsc_code, branch_name, bank_name, emp_id]
                    )
                    status_code = 200
                else:
                    c.execute(
                        '''INSERT INTO emp_bank_info
                           (emp_id, bank_acct_no, ifsc_code, branch_name, bank_name)
                           VALUES (%s, %s, %s, %s, %s)''',
                        [emp_id, bank_acct_no, ifsc_code, branch_name, bank_name]
                    )
                    status_code = 201

                c.execute('SELECT * FROM emp_bank_info WHERE emp_id = %s', [emp_id])
                row = _row_as_dict(c)

            return JsonResponse(_serialize_row(row), status=status_code)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ─── emp_ctc_info  ───────────────────────────────────────────────────────────
class EmpCTCInfoView(View):
    """
    GET  /api/team38/<emp_id>/ctc-info
    POST /api/team38/<emp_id>/ctc-info

    Table: emp_ctc_info
    Columns: emp_id, int_title, ext_title, main_level, sub_level,
             start_of_ctc, end_of_ctc, ctc_amt
    """

    def get(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                c.execute(
                    'SELECT * FROM emp_ctc_info WHERE emp_id = %s ORDER BY start_of_ctc DESC',
                    [emp_id]
                )
                rows = _rows_as_dicts(c)
            return JsonResponse(_serialize_rows(rows), safe=False)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            payload      = _json_body(request)
            int_title    = (payload.get('int_title')    or '').strip()
            ext_title    = (payload.get('ext_title')    or '').strip()
            main_level   = payload.get('main_level')
            sub_level    = (payload.get('sub_level')    or '').strip()
            start_of_ctc = payload.get('start_of_ctc')
            end_of_ctc   = payload.get('end_of_ctc') or None
            ctc_amt      = payload.get('ctc_amt')

            if not int_title or not ext_title or main_level is None \
                    or not sub_level or not start_of_ctc or ctc_amt is None:
                return JsonResponse(
                    {'error': 'int_title, ext_title, main_level, sub_level, start_of_ctc, ctc_amt are required'},
                    status=400
                )

            # --- Auto-Close / Overlap Logic ---
            from datetime import datetime, timedelta
            new_start = datetime.strptime(start_of_ctc, '%Y-%m-%d').date()
            new_end   = datetime.strptime(end_of_ctc, '%Y-%m-%d').date() if end_of_ctc else None

            with connection.cursor() as c:
                # 1. Fetch existing records
                c.execute('SELECT emp_ctc_id, start_of_ctc, end_of_ctc FROM emp_ctc_info WHERE emp_id = %s', [emp_id])
                existing = _rows_as_dicts(c)

                for ex in existing:
                    ex_id    = ex['emp_ctc_id']
                    ex_start = ex['start_of_ctc']
                    ex_end   = ex['end_of_ctc']

                    # Check for overlap
                    overlap = True
                    if new_end and ex_start > new_end:
                        overlap = False
                    if ex_end and new_start > ex_end:
                        overlap = False
                    
                    if overlap:
                        # PROACTIVE FIX: If the old record is "Present" and new record starts after it,
                        # automatically close the old one.
                        if ex_end is None and new_start > ex_start:
                            auto_close_date = new_start - timedelta(days=1)
                            c.execute(
                                'UPDATE emp_ctc_info SET end_of_ctc = %s WHERE emp_ctc_id = %s',
                                [auto_close_date, ex_id]
                            )
                            continue # Successfully handled this "overlap" by closing the old record
                        
                        return JsonResponse(
                            {'error': f'Overlapping date entry detected. Interval starts at {ex_start} and ends at {ex_end or "Present"}.'},
                            status=400
                        )

                # 2. Insert the new record
                c.execute(
                    '''INSERT INTO emp_ctc_info
                       (emp_id, int_title, ext_title, main_level, sub_level,
                        start_of_ctc, end_of_ctc, ctc_amt)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
                    [emp_id, int_title, ext_title, main_level, sub_level,
                     start_of_ctc, end_of_ctc, ctc_amt]
                )
                new_id = c.lastrowid
                c.execute('SELECT * FROM emp_ctc_info WHERE emp_ctc_id = %s', [new_id])
                row = _row_as_dict(c)

            return JsonResponse(_serialize_row(row), status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ─── emp_compliance_tracker  ─────────────────────────────────────────────────
class EmpComplianceTrackerView(View):
    """
    GET  /api/team38/<emp_id>/compliance
    POST /api/team38/<emp_id>/compliance

    Table: emp_compliance_tracker
    Columns: emp_id, comp_type, status, doc_url
    """

    def get(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                c.execute(
                    'SELECT * FROM emp_compliance_tracker WHERE emp_id = %s', [emp_id]
                )
                rows = _rows_as_dicts(c)
            return JsonResponse(_serialize_rows(rows), safe=False)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            payload   = _json_body(request)
            comp_type = (payload.get('comp_type') or '').strip()
            status_val = (payload.get('status')   or '').strip()
            doc_url   = (payload.get('doc_url')   or '').strip()

            if not comp_type or not status_val or not doc_url:
                return JsonResponse(
                    {'error': 'comp_type, status, doc_url are required'}, status=400
                )

            with connection.cursor() as c:
                # check duplicate
                c.execute(
                    'SELECT emp_compliance_tracker_id FROM emp_compliance_tracker WHERE emp_id=%s AND comp_type=%s',
                    [emp_id, comp_type]
                )
                existing = c.fetchone()
                if existing:
                    c.execute(
                        'UPDATE emp_compliance_tracker SET status=%s, doc_url=%s WHERE emp_id=%s AND comp_type=%s',
                        [status_val, doc_url, emp_id, comp_type]
                    )
                    c.execute(
                        'SELECT * FROM emp_compliance_tracker WHERE emp_id=%s AND comp_type=%s',
                        [emp_id, comp_type]
                    )
                    status_code = 200
                else:
                    c.execute(
                        '''INSERT INTO emp_compliance_tracker
                           (emp_id, comp_type, status, doc_url)
                           VALUES (%s, %s, %s, %s)''',
                        [emp_id, comp_type, status_val, doc_url]
                    )
                    c.execute(
                        'SELECT * FROM emp_compliance_tracker WHERE emp_id=%s AND comp_type=%s',
                        [emp_id, comp_type]
                    )
                    status_code = 201
                row = _row_as_dict(c)

            return JsonResponse(_serialize_row(row), status=status_code)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ─── emp_reg_info  ───────────────────────────────────────────────────────────
class EmpRegInfoView(View):
    """
    GET  /api/team38/<emp_id>/reg-info
    POST /api/team38/<emp_id>/reg-info

    Table: emp_reg_info
    Columns: emp_id, pan, aadhaar, uan_epf_acctno, esi
    """

    def get(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                c.execute('SELECT * FROM emp_reg_info WHERE emp_id = %s', [emp_id])
                row = _row_as_dict(c)
            return JsonResponse(_serialize_row(row) if row else {})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    def post(self, request: HttpRequest, emp_id: int) -> JsonResponse:
        from django.db import connection
        try:
            payload      = _json_body(request)
            pan          = (payload.get('pan')           or '').strip().upper()
            aadhaar      = (payload.get('aadhaar')       or '').strip()
            uan_epf      = (payload.get('uan_epf_acctno') or '').strip()
            esi          = (payload.get('esi')            or '').strip()

            if not pan or not aadhaar:
                return JsonResponse({'error': 'pan and aadhaar are required'}, status=400)

            with connection.cursor() as c:
                c.execute('SELECT emp_reg_info_id FROM emp_reg_info WHERE emp_id=%s', [emp_id])
                existing = c.fetchone()
                if existing:
                    c.execute(
                        'UPDATE emp_reg_info SET pan=%s, aadhaar=%s, uan_epf_acctno=%s, esi=%s WHERE emp_id=%s',
                        [pan, aadhaar, uan_epf, esi, emp_id]
                    )
                    status_code = 200
                else:
                    c.execute(
                        'INSERT INTO emp_reg_info (emp_id, pan, aadhaar, uan_epf_acctno, esi) VALUES (%s,%s,%s,%s,%s)',
                        [emp_id, pan, aadhaar, uan_epf, esi]
                    )
                    status_code = 201

                c.execute('SELECT * FROM emp_reg_info WHERE emp_id = %s', [emp_id])
                row = _row_as_dict(c)

            return JsonResponse(_serialize_row(row), status=status_code)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ─── Compliance Dashboard  ──────────────────────────────────────────────────


# ─── Keep old classes for BankDetailView / CTCHistoryView / ComplianceIDView
#     (used by existing /api/employees/* routes for the employee_* tables)
class BankDetailView(View):
    def _employee(self, pk): return get_object_or_404(Employee, pk=pk)
    def get(self, request, pk):
        emp = self._employee(pk); bd = getattr(emp, 'bank_detail', None)
        return JsonResponse({} if bd is None else BankDetailSerializer(bd).data)
    def post(self, request, pk):
        try:
            emp = self._employee(pk); payload = _json_body(request)
            allowed = {'account_holder_name','account_number','ifsc_code','bank_name','branch_name','account_type'}
            data = {k:v for k,v in payload.items() if k in allowed}
            bd, created = BankDetail.objects.get_or_create(employee=emp, defaults=data)
            if not created:
                for k,v in data.items(): setattr(bd,k,v)
                bd.save()
            return JsonResponse(BankDetailSerializer(bd).data, status=201 if created else 200)
        except Exception as e: return JsonResponse({'error':str(e)}, status=500)

class CTCHistoryView(View):
    def _employee(self, pk): return get_object_or_404(Employee, pk=pk)
    def get(self, request, pk):
        emp = self._employee(pk)
        return JsonResponse(CTCHistorySerializer(emp.ctc_history.all(), many=True).data, safe=False)
    def post(self, request, pk):
        try:
            emp = self._employee(pk); payload = _json_body(request)
            ctc_amount = payload.get('ctc_amount'); effective_date = payload.get('effective_date')
            if not ctc_amount or not effective_date:
                return JsonResponse({'error':'ctc_amount and effective_date required'}, status=400)
            record = CTCHistory.objects.create(employee=emp, ctc_amount=ctc_amount, effective_date=effective_date)
            return JsonResponse(CTCHistorySerializer(record).data, status=201)
        except Exception as e: return JsonResponse({'error':str(e)}, status=500)

class ComplianceIDView(View):
    VALID_TYPES = {'PAN','AADHAAR','PASSPORT','DL','VOTER_ID'}
    def _employee(self, pk): return get_object_or_404(Employee, pk=pk)
    def get(self, request, pk):
        emp = self._employee(pk)
        return JsonResponse(ComplianceIDSerializer(emp.compliance_ids.all(), many=True).data, safe=False)
    def post(self, request, pk):
        try:
            emp = self._employee(pk); payload = _json_body(request)
            ct = (payload.get('compliance_type') or '').upper()
            ci = (payload.get('compliance_id') or '').strip()
            if ct not in self.VALID_TYPES:
                return JsonResponse({'error':f'compliance_type must be one of {sorted(self.VALID_TYPES)}'}, status=400)
            if not ci:
                return JsonResponse({'error':'compliance_id required'}, status=400)
            from .models import ComplianceID
            record, created = ComplianceID.objects.update_or_create(
                employee=emp, compliance_type=ct,
                defaults={'compliance_id':ci,'issued_date':payload.get('issued_date') or None,
                          'validity_date':payload.get('validity_date') or None,
                          'issuing_authority':payload.get('issuing_authority') or None})
            return JsonResponse(ComplianceIDSerializer(record).data, status=201 if created else 200)
        except Exception as e: return JsonResponse({'error':str(e)}, status=500)


class OnboardingChecklistView(View):
    """Manage onboarding checklist items for employees"""
    VALID_ITEMS = {'PAN_CARD','AADHAAR_CARD','UAN_EPF','ESI','BANK_DETAILS','PASSPORT','DRIVING_LICENSE','FORM_COMPLETED','DOCUMENTS_VERIFIED'}
    
    def _employee(self, pk): 
        return get_object_or_404(Employee, pk=pk)
    
    def get(self, request, pk):
        """Get all onboarding checklist items for an employee"""
        try:
            emp = self._employee(pk)
            items = emp.onboarding_checklist.all()
            serializer = OnboardingChecklistSerializer(items, many=True)
            
            # Calculate completion stats
            total = items.count()
            completed = items.filter(is_completed=True).count()
            completion_percent = (completed / total * 100) if total > 0 else 0
            
            return JsonResponse({
                'employee_id': emp.id,
                'emp_id': emp.emp_id,
                'employee_name': f"{emp.first_name} {emp.last_name}",
                'checklist': serializer.data,
                'stats': {
                    'total_items': total,
                    'completed_items': completed,
                    'pending_items': total - completed,
                    'completion_percentage': round(completion_percent, 2)
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    def post(self, request, pk):
        """Create or update a checklist item"""
        try:
            emp = self._employee(pk)
            payload = _json_body(request)
            
            item_name = (payload.get('item_name') or '').upper()
            is_completed = payload.get('is_completed', False)
            document_url = payload.get('document_url')
            notes = payload.get('notes')
            
            if item_name not in self.VALID_ITEMS:
                return JsonResponse({
                    'error': f'item_name must be one of {sorted(self.VALID_ITEMS)}'
                }, status=400)
            
            from django.utils import timezone
            
            record, created = OnboardingChecklist.objects.update_or_create(
                employee=emp,
                item_name=item_name,
                defaults={
                    'is_completed': is_completed,
                    'document_url': document_url,
                    'notes': notes,
                    'completed_date': timezone.now() if is_completed else None
                }
            )
            
            return JsonResponse(
                OnboardingChecklistSerializer(record).data,
                status=201 if created else 200
            )
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    def patch(self, request, pk, item_id=None):
        """Update completion status of a checklist item"""
        try:
            emp = self._employee(pk)
            payload = _json_body(request)
            
            if not item_id:
                return JsonResponse({'error': 'Item ID is required'}, status=400)
            
            record = get_object_or_404(OnboardingChecklist, id=item_id, employee=emp)
            
            if 'is_completed' in payload:
                from django.utils import timezone
                record.is_completed = payload['is_completed']
                record.completed_date = timezone.now() if payload['is_completed'] else None
            
            if 'document_url' in payload:
                record.document_url = payload['document_url']
            
            if 'notes' in payload:
                record.notes = payload['notes']
            
            record.save()
            
            return JsonResponse(OnboardingChecklistSerializer(record).data)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)



# ─── File Upload View ───────────────────────────────────────────────────────

class Team38DocUploadView(View):
    """
    POST /api/team38/upload
    Expects 'file' in request.FILES
    Returns {'url': '...'}
    """
    def post(self, request: HttpRequest) -> JsonResponse:
        if not request.FILES.get('file'):
            return JsonResponse({'error': 'No file provided'}, status=400)
            
        uploaded_file = request.FILES['file']
        ext = os.path.splitext(uploaded_file.name)[1]
        filename = f"{uuid.uuid4()}{ext}"
        
        path = default_storage.save(f"compliance_docs/{filename}", ContentFile(uploaded_file.read()))
        # Use a relative URL that will be prefixed by the frontend or match MEDIA_URL
        url = f"/media/{path}"
        
        return JsonResponse({'url': url})


# ─── Compliance Dashboard & Actions ──────────────────────────────────────────

class Team38ComplianceDashboardView(View):
    """
    GET /api/team38/compliance-dashboard
    Returns metrics and employee list for HR compliance visibility.
    """
    def get(self, request: HttpRequest) -> JsonResponse:
        from django.db import connection
        try:
            REQUIRED_DOCS = ['PAN_CARD', 'AADHAAR_CARD']
            
            with connection.cursor() as c:
                # 1. Basic Stats
                c.execute('SELECT COUNT(*) FROM emp_master WHERE end_date IS NULL')
                total_emps = c.fetchone()[0]
                
                c.execute('SELECT status, COUNT(*) FROM emp_compliance_tracker GROUP BY status')
                status_raw = c.fetchall()
                status_map = {str(r[0]).upper(): r[1] for r in status_raw}
                
                # 2. Detailed Employee List for Compliance
                c.execute('''
                    SELECT 
                        m.emp_id, 
                        CONCAT(m.first_name, ' ', IFNULL(m.last_name, '')) as full_name
                    FROM emp_master m
                    WHERE m.end_date IS NULL
                ''')
                employees = _rows_as_dicts(c)
                
                c.execute('SELECT * FROM emp_compliance_tracker')
                all_docs = _rows_as_dicts(c)
                
                employee_data_list = []
                compliant_count = 0
                
                for emp in employees:
                    emp_id = emp['emp_id']
                    emp_docs = [d for d in all_docs if d['emp_id'] == emp_id]
                    
                    doc_types_uploaded = [d['comp_type'] for d in emp_docs]
                    verified_types = [d['comp_type'] for d in emp_docs if d['status'] == 'VERIFIED']
                    
                    missing = [rd for rd in REQUIRED_DOCS if rd not in doc_types_uploaded]
                    is_compliant = all(rd in verified_types for rd in REQUIRED_DOCS)
                    
                    if is_compliant:
                        compliant_count += 1
                        
                    employee_data_list.append({
                        'emp_id': emp_id,
                        'full_name': emp['full_name'],
                        'total_documents': len(emp_docs),
                        'verified_count': len(verified_types),
                        'pending_count': len([d for d in emp_docs if d['status'] == 'PENDING']),
                        'rejected_count': len([d for d in emp_docs if d['status'] == 'REJECTED']),
                        'missing_documents': missing,
                        'is_compliant': is_compliant,
                        'documents': [{
                            'compliance_id': d['emp_compliance_tracker_id'],
                            'doc_type': d['comp_type'],
                            'status': d['status'],
                            'doc_url': d['doc_url']
                        } for d in emp_docs]
                    })

                # 3. Final Metrics
                metrics = {
                    'total_employees': total_emps,
                    'compliant_employees': compliant_count,
                    'compliance_rate': round((compliant_count / total_emps * 100) if total_emps > 0 else 0, 1),
                    'pending_verifications': status_map.get('PENDING', 0),
                    'verified_documents': status_map.get('VERIFIED', 0),
                    'rejected_documents': status_map.get('REJECTED', 0),
                    'total_documents': len(all_docs),
                    'employees_with_missing': len([e for e in employee_data_list if e['missing_documents']])
                }

            return JsonResponse({
                'dashboard': {
                    'metrics': metrics,
                    'employee_list': employee_data_list,
                    'required_documents': REQUIRED_DOCS
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

class Team38ComplianceStatusUpdateView(View):
    """
    PUT /api/team38/compliance-action/<compliance_id>
    Body: { status: 'verified' | 'rejected' }
    """
    def put(self, request: HttpRequest, compliance_id: int) -> JsonResponse:
        from django.db import connection
        try:
            payload = _json_body(request)
            status = payload.get('status', '').upper()
            if status not in ['VERIFIED', 'REJECTED', 'PENDING']:
                return JsonResponse({'error': 'Invalid status'}, status=400)
                
            with connection.cursor() as c:
                c.execute(
                    'UPDATE emp_compliance_tracker SET status = %s WHERE emp_compliance_tracker_id = %s',
                    [status, compliance_id]
                )
            return JsonResponse({'message': f'Status updated to {status}'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# ─── Reports ───────────────────────────────────────────────────────────────

class Team38HeadcountReportView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                # 1. Overall headcount
                c.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN end_date IS NULL THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN end_date IS NOT NULL THEN 1 ELSE 0 END) as exited
                    FROM emp_master
                """)
                row = c.fetchone()
                hc = {
                    'total': row[0] if row else 0,
                    'active': int(row[1]) if row and row[1] else 0,
                    'exited': int(row[2]) if row and row[2] else 0
                }
                
                # 2. Breakdown by "department" (latest int_title)
                c.execute("""
                    SELECT 
                        IFNULL(ctc.int_title, 'Other') as department,
                        COUNT(*) as total,
                        SUM(CASE WHEN m.end_date IS NULL THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN m.end_date IS NOT NULL THEN 1 ELSE 0 END) as exited
                    FROM emp_master m
                    LEFT JOIN emp_ctc_info ctc ON ctc.emp_ctc_id = (
                        SELECT emp_ctc_id FROM emp_ctc_info 
                        WHERE emp_id = m.emp_id 
                        ORDER BY start_of_ctc DESC LIMIT 1
                    )
                    GROUP BY IFNULL(ctc.int_title, 'Other')
                """)
                depts = _rows_as_dicts(c)
                
            return JsonResponse({
                'headcount': hc,
                'departments': _serialize_rows(depts)
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class Team38JoinersLeaversReportView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                # Joiners by month
                c.execute("""
                    SELECT DATE_FORMAT(start_date, '%Y-%m') as month, COUNT(*) as count
                    FROM emp_master
                    WHERE start_date IS NOT NULL
                    GROUP BY month
                """)
                joiners = _rows_as_dicts(c)
                
                # Leavers by month
                c.execute("""
                    SELECT DATE_FORMAT(end_date, '%Y-%m') as month, COUNT(*) as count
                    FROM emp_master
                    WHERE end_date IS NOT NULL
                    GROUP BY month
                """)
                leavers = _rows_as_dicts(c)
                
                # Total counts
                c.execute("SELECT COUNT(*) FROM emp_master WHERE start_date IS NOT NULL")
                total_j = c.fetchone()[0]
                c.execute("SELECT COUNT(*) FROM emp_master WHERE end_date IS NOT NULL")
                total_l = c.fetchone()[0]

            # Merge joiners and leavers into a timeline
            months = sorted(list(set([j['month'] for j in joiners] + [l['month'] for l in leavers])))
            timeline = []
            for m in months:
                j_count = next((x['count'] for x in joiners if x['month'] == m), 0)
                l_count = next((x['count'] for x in leavers if x['month'] == m), 0)
                timeline.append({
                    'month': m,
                    'joiners': j_count,
                    'leavers': l_count
                })
                
            return JsonResponse({
                'timeline': timeline,
                'total_joiners': total_j,
                'total_leavers': total_l
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class Team38CTCReportView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        from django.db import connection
        try:
            with connection.cursor() as c:
                # Get latest CTC for all employees
                c.execute("""
                    SELECT ctc_amt, main_level, sub_level
                    FROM emp_ctc_info ctc
                    WHERE emp_ctc_id IN (
                        SELECT MAX(emp_ctc_id) FROM emp_ctc_info GROUP BY emp_id
                    )
                """)
                data = _rows_as_dicts(c)
                
                if not data:
                    return JsonResponse({'salary_bands': [], 'levels': [], 'total_with_ctc': 0})

                # Band calculation
                # (ctc_amt is stored as full value, e.g. 500000)
                bands = {
                    '0-3L': 0, '3-6L': 0, '6-10L': 0, '10-15L': 0, '15-25L': 0, '25L+': 0
                }
                for row in data:
                    amt = (row['ctc_amt'] or 0) / 100000 # Convert to Lakhs
                    if amt < 3: bands['0-3L'] += 1
                    elif amt < 6: bands['3-6L'] += 1
                    elif amt < 10: bands['6-10L'] += 1
                    elif amt < 15: bands['10-15L'] += 1
                    elif amt < 25: bands['15-25L'] += 1
                    else: bands['25L+'] += 1
                
                band_list = [{'band': k, 'count': v} for k, v in bands.items()]
                
                # Level calculation
                levels = {}
                for row in data:
                    ml = row.get('main_level') or 1
                    sl = row.get('sub_level') or 'A'
                    lvl = f"L{ml}{sl}"
                    levels[lvl] = levels.get(lvl, 0) + 1
                
                level_list = sorted([{'level': k, 'count': v} for k, v in levels.items()], key=lambda x: x['level'])
                
            return JsonResponse({
                'salary_bands': band_list,
                'levels': level_list,
                'total_with_ctc': len(data)
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
