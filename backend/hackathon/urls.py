from django.urls import path

from .views import (
    ApiForgotPasswordView,
    ApiLoginView,
    ApiLogoutView,
    ApiMeView,
    ApiOtpRequestView,
    ApiOtpVerifyView,
    ApiRegisterView,
    HealthView,
    EmployeeListCreateView,
    EmployeeDetailView,
    EmployeeExitView,
    ApiTestExternalAuthView,
    EmployeeProfileView,
    EmployeeProfileByEmpIdView,
    EmployeeProfileCTCTimelineView,
    BankDetailView,
    CTCHistoryView,
    ComplianceIDView,
    OnboardingChecklistView,
    # Team38 raw-table views
    Team38EmployeeListView,
    Team38ProfileView,
    EmpMasterView,
    EmpMasterDetailView,
    EmpMasterExitView,
    EmpBankInfoView,
    EmpCTCInfoView,
    EmpComplianceTrackerView,
    EmpRegInfoView,
    Team38DocUploadView,
    Team38ComplianceDashboardView,
    Team38ComplianceStatusUpdateView,
    Team38HeadcountReportView,
    Team38JoinersLeaversReportView,
    Team38CTCReportView,
)

urlpatterns = [
    # Reports
    path('api/team38/reports/headcount',       Team38HeadcountReportView.as_view(),       name='team38_report_headcount'),
    path('api/team38/reports/joiners-leavers', Team38JoinersLeaversReportView.as_view(), name='team38_report_joiners_leavers'),
    path('api/team38/reports/ctc',             Team38CTCReportView.as_view(),             name='team38_report_ctc'),

    path('api/team38/compliance-dashboard', Team38ComplianceDashboardView.as_view(), name='team38_compliance_dashboard'),
    path('api/team38/compliance-action/<int:compliance_id>', Team38ComplianceStatusUpdateView.as_view(), name='team38_compliance_action'),
    path('api/team38/upload', Team38DocUploadView.as_view(), name='team38_upload'),
    path('', HealthView.as_view(), name='health'),
    path('api/login', ApiLoginView.as_view(), name='api_login'),
    path('api/register', ApiRegisterView.as_view(), name='api_register'),
    path('api/forgot-password', ApiForgotPasswordView.as_view(), name='api_forgot_password'),
    path('api/otp/request', ApiOtpRequestView.as_view(), name='api_otp_request'),
    path('api/otp/verify', ApiOtpVerifyView.as_view(), name='api_otp_verify'),
    path('api/home', ApiMeView.as_view(), name='api_home'),
    path('api/logout', ApiLogoutView.as_view(), name='api_logout'),
    path('api/test-auth', ApiTestExternalAuthView.as_view(), name='test_external_auth'),

    # Employee CRUD (employee_master Django table)
    path('api/employees', EmployeeListCreateView.as_view(), name='employee_list_create'),
    path('api/employees/<int:pk>', EmployeeDetailView.as_view(), name='employee_detail'),
    path('api/employees/<int:pk>/exit', EmployeeExitView.as_view(), name='employee_exit'),

    # Sub-resources (employee_* Django tables)
    path('api/employees/<int:pk>/bank-detail', BankDetailView.as_view(), name='employee_bank_detail'),
    path('api/employees/<int:pk>/ctc-history', CTCHistoryView.as_view(), name='employee_ctc_history'),
    path('api/employees/<int:pk>/compliance', ComplianceIDView.as_view(), name='employee_compliance'),
    path('api/employees/<int:pk>/onboarding-checklist', OnboardingChecklistView.as_view(), name='employee_onboarding_checklist'),

    # Unified Employee Profile (Django employee_* tables)
    path('api/profile/<int:employee_id>', EmployeeProfileView.as_view(), name='employee_profile'),
    path('api/profile/<str:emp_id>', EmployeeProfileByEmpIdView.as_view(), name='employee_profile_by_emp_id'),
    path('api/profile/<int:employee_id>/ctc-timeline', EmployeeProfileCTCTimelineView.as_view(), name='employee_profile_ctc_timeline'),

    # ── TEAM38 original schema (emp_master, emp_bank_info, emp_ctc_info, …) ──
    # emp_master CRUD
    path('api/team38/emp-master',                   EmpMasterView.as_view(),       name='team38_emp_master_list'),
    path('api/team38/emp-master/<int:emp_id>',       EmpMasterDetailView.as_view(), name='team38_emp_master_detail'),
    path('api/team38/emp-master/<int:emp_id>/exit',  EmpMasterExitView.as_view(),   name='team38_emp_master_exit'),
    # full joined list
    path('api/team38/employees',              Team38EmployeeListView.as_view(),    name='team38_employees'),
    path('api/team38/profile/<int:emp_id>',   Team38ProfileView.as_view(),         name='team38_profile'),
    path('api/team38/<int:emp_id>/bank-info',  EmpBankInfoView.as_view(),          name='team38_bank_info'),
    path('api/team38/<int:emp_id>/ctc-info',   EmpCTCInfoView.as_view(),           name='team38_ctc_info'),
    path('api/team38/<int:emp_id>/compliance', EmpComplianceTrackerView.as_view(), name='team38_compliance'),
    path('api/team38/<int:emp_id>/reg-info',   EmpRegInfoView.as_view(),           name='team38_reg_info'),
]

