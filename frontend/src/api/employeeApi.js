import { httpJson } from './http.js'

/* ─── Team38 unified profile GET ──────────────────────────────────────────────
 * GET /api/team38/profile/:emp_id
 * Returns: {
 *   emp_master:             { emp_id, first_name, middle_name, last_name, start_date, end_date },
 *   emp_bank_info:          { emp_bank_id, emp_id, bank_acct_no, ifsc_code, branch_name, bank_name } | null,
 *   emp_ctc_info:           [{ emp_ctc_id, emp_id, int_title, ext_title, main_level, sub_level, start_of_ctc, end_of_ctc, ctc_amt }],
 *   emp_compliance_tracker: [{ emp_compliance_tracker_id, emp_id, comp_type, status, doc_url }],
 *   emp_reg_info:           { emp_reg_info_id, emp_id, pan, aadhaar, uan_epf_acctno, esi } | null,
 * }
 */
export function apiGetTeam38Profile({ token, empId }) {
    return httpJson(`/api/team38/profile/${empId}`, { token })
}

export function apiGetComplianceDashboard({ token }) {
    return httpJson('/api/team38/compliance-dashboard', { token })
}

export function apiUpdateComplianceStatus({ token, complianceId, status }) {
    return httpJson(`/api/team38/compliance-action/${complianceId}`, {
        method: 'PUT',
        token,
        body: { status }
    })
}


/* ─── emp_bank_info ────────────────────────────────────────────────────────────
 * POST /api/team38/:emp_id/bank-info
 * Body fields (exact column names from emp_bank_info):
 *   bank_acct_no  varchar(20)   UNIQUE  required
 *   ifsc_code     varchar(11)   required
 *   branch_name   varchar(100)
 *   bank_name     varchar(100)  required
 */
export function apiSaveBankInfo({ token, empId, bank_acct_no, ifsc_code, branch_name, bank_name }) {
    return httpJson(`/api/team38/${empId}/bank-info`, {
        method: 'POST', token,
        body: { bank_acct_no, ifsc_code, branch_name, bank_name },
    })
}

/* ─── emp_ctc_info ─────────────────────────────────────────────────────────────
 * POST /api/team38/:emp_id/ctc-info
 * Body fields (exact column names from emp_ctc_info):
 *   int_title     varchar(30)   required
 *   ext_title     varchar(60)   required
 *   main_level    tinyint       required
 *   sub_level     char(1)       required   (e.g. 'A','B','C')
 *   start_of_ctc  date          required   (YYYY-MM-DD)
 *   end_of_ctc    date          optional
 *   ctc_amt       int unsigned  required
 */
export function apiAddCTCInfo({ token, empId, ...body }) {
    return httpJson(`/api/team38/${empId}/ctc-info`, { method: 'POST', token, body })
}

/* ─── emp_compliance_tracker ───────────────────────────────────────────────────
 * POST /api/team38/:emp_id/compliance
 * Body fields (exact column names from emp_compliance_tracker):
 *   comp_type  varchar(60)   required
 *   status     varchar(20)   required
 *   doc_url    varchar(255)  required
 */
export function apiSaveCompliance({ token, empId, comp_type, status, doc_url }) {
    return httpJson(`/api/team38/${empId}/compliance`, {
        method: 'POST', token,
        body: { comp_type, status, doc_url },
    })
}

/* ─── File Upload ─────────────────────────────────────────────────────────────
 * POST /api/team38/upload
 */
export async function apiUploadDocument({ token, file }) {
    const formData = new FormData()
    formData.append('file', file)

    const resp = await fetch('http://localhost:8000/api/team38/upload', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Upload failed')
    }
    return resp.json()
}

/* ─── emp_reg_info ─────────────────────────────────────────────────────────────
 * POST /api/team38/:emp_id/reg-info
 * Body fields (exact column names from emp_reg_info):
 *   pan            varchar(10)  required
 *   aadhaar        char(12)     required
 *   uan_epf_acctno varchar(20)
 *   esi            varchar(25)
 */
export function apiSaveRegInfo({ token, empId, pan, aadhaar, uan_epf_acctno, esi }) {
    return httpJson(`/api/team38/${empId}/reg-info`, {
        method: 'POST', token,
        body: { pan, aadhaar, uan_epf_acctno, esi },
    })
}

/* ─── Exit Employee (Team38) ────────────────────────────────────────────────
 * POST /api/team38/emp-master/:emp_id/exit
 * Body: { exit_date: 'YYYY-MM-DD' }
 */
export function apiExitEmployeeTeam38({ token, empId, exit_date }) {
    return httpJson(`/api/team38/emp-master/${empId}/exit`, {
        method: 'POST', token,
        body: { exit_date },
    })
}

/* ─── Legacy Django employee_* table APIs (kept for directory page) ────────── */
export function apiGetEmployees({ token }) {
    return httpJson('/api/employees', { token })
}
export function apiCreateEmployee({ token, ...body }) {
    return httpJson('/api/employees', { method: 'POST', token, body })
}
export function apiUpdateEmployee({ token, pk, ...body }) {
    return httpJson(`/api/employees/${pk}`, { method: 'PUT', token, body })
}
export function apiExitEmployee({ token, pk, exit_date }) {
    return httpJson(`/api/employees/${pk}/exit`, { method: 'POST', token, body: { exit_date } })
}
