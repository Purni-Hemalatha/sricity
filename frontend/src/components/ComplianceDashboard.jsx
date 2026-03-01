import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiGetComplianceDashboard, apiUpdateComplianceStatus } from '../api/employeeApi.js'
import '../styles/ComplianceDashboard.css'

function ComplianceDashboard() {
    // ────────────────────────────────────────────────────────────────────
    // HOOKS - Get authentication token and navigation function
    // ────────────────────────────────────────────────────────────────────
    const { token } = useAuth()         // Get JWT token from AuthContext
    const navigate = useNavigate()       // Function to navigate to other pages

    // ────────────────────────────────────────────────────────────────────
    // STATE MANAGEMENT - Using React Hooks to manage component data
    // ────────────────────────────────────────────────────────────────────

    // Dashboard data from backend (metrics + employee list)
    const [dashboard, setDashboard] = useState(null)

    // Loading state - shows spinner while fetching data
    const [loading, setLoading] = useState(true)

    // Error state - stores error message if API call fails
    const [error, setError] = useState(null)

    // Filter state - controls which employees to display
    // Options: 'all', 'compliant', 'non-compliant'
    const [filter, setFilter] = useState('all')

    // Expandable rows - tracks which employee rows are expanded
    // Using Set data structure for efficient add/remove operations
    const [expandedRows, setExpandedRows] = useState(new Set())

    // Action loading - tracks which verify/reject button is processing
    // Format: 'verify-123' or 'reject-456' (action type + compliance ID)
    const [actionLoading, setActionLoading] = useState(null)

    // ────────────────────────────────────────────────────────────────────
    // LOAD DASHBOARD DATA - Fetches compliance data from backend
    // ────────────────────────────────────────────────────────────────────
    const loadDashboard = async () => {
        try {
            setLoading(true)          // Show loading spinner
            setError(null)            // Clear any previous errors

            // API call to backend: GET /api/compliance/dashboard
            // Backend calculates: total employees, compliant count, pending verifications, etc.
            const data = await apiGetComplianceDashboard({ token })

            // Update state with dashboard data
            // data.dashboard contains: { metrics: {...}, employee_list: [...], required_documents: [...] }
            setDashboard(data.dashboard)
        } catch (err) {
            // If API call fails, store error message
            setError(err.message || 'Failed to load dashboard')
        } finally {
            // Always hide loading spinner (success or fail)
            setLoading(false)
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // TOGGLE ROW EXPANSION - Show/hide employee's document details
    // ────────────────────────────────────────────────────────────────────
    const toggleRow = (empId) => {
        // Create a new Set from current expanded rows
        const newExpanded = new Set(expandedRows)

        // If employee row is already expanded, collapse it
        if (newExpanded.has(empId)) {
            newExpanded.delete(empId)
        }
        // If employee row is collapsed, expand it
        else {
            newExpanded.add(empId)
        }

        // Update state with new Set
        // React will re-render and show/hide document details
        setExpandedRows(newExpanded)
    }

    // ────────────────────────────────────────────────────────────────────
    // QUICK VERIFY ACTION - Verify a document without leaving this page
    // ────────────────────────────────────────────────────────────────────
    const handleQuickVerify = async (complianceId, docType, empId) => {
        // Ask for confirmation before verifying
        if (!confirm(`Verify ${docType}?`)) return

        // Set loading state for this specific button
        setActionLoading(`verify-${complianceId}`)

        try {
            // API call to backend: PUT /api/team38/compliance-action/{complianceId}
            await apiUpdateComplianceStatus({ token, complianceId, status: 'VERIFIED' })

            // Show success message
            // alert(`${docType} verified successfully!`)

            // Refresh dashboard to show updated data
            await loadDashboard()
        } catch (err) {
            alert(`Failed to verify: ${err.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // QUICK REJECT ACTION - Reject a document and ask for reason
    // ────────────────────────────────────────────────────────────────────
    const handleQuickReject = async (complianceId, docType, empId) => {
        const reason = prompt(`Reject ${docType}?\nEnter rejection reason:`)
        if (!reason) return

        setActionLoading(`reject-${complianceId}`)

        try {
            // API call to backend: PUT /api/team38/compliance-action/{complianceId}
            await apiUpdateComplianceStatus({ token, complianceId, status: 'REJECTED' })

            // alert(`${docType} rejected. Employee can reupload.`)
            await loadDashboard()
        } catch (err) {
            alert(`Failed to reject: ${err.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // COMPONENT LIFECYCLE - Run code when component mounts
    // ────────────────────────────────────────────────────────────────────
    useEffect(() => {
        loadDashboard()
    }, [token])

    // ────────────────────────────────────────────────────────────────────
    // LOADING STATE - Show spinner while fetching data
    // ────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        )
    }

    // ────────────────────────────────────────────────────────────────────
    // ERROR STATE - Show error message if API call failed
    // ────────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="dashboard-container">
                <div className="alert alert-danger">{error}</div>
                <button className="btn btn-primary" onClick={() => navigate('/home')}>
                    <i className="bi bi-arrow-left"></i> Back to Home
                </button>
            </div>
        )
    }

    if (!dashboard) {
        return (
            <div className="dashboard-container">
                <div className="alert alert-warning">No dashboard data available</div>
            </div>
        )
    }

    const { metrics, employee_list, required_documents } = dashboard

    // Filter employees
    const filteredEmployees = employee_list.filter(emp => {
        if (filter === 'compliant') return emp.is_compliant
        if (filter === 'non-compliant') return !emp.is_compliant
        return true
    })

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/directory')}>
                    <i className="bi bi-arrow-left"></i> Back to Directory
                </button>
                <h2><i className="bi bi-bar-chart-fill"></i> Compliance Dashboard</h2>
                <div className="d-flex gap-2">
                    <button className="btn btn-primary" onClick={loadDashboard}>
                        <i className="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="alert alert-info d-flex align-items-center mb-4 border-0 shadow-sm" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                <i className="bi bi-lightning-charge-fill me-2" style={{ fontSize: '1.5rem' }}></i>
                <div>
                    <strong>HR Management Hub:</strong> Expand any employee row to verify or reject documents instantly.
                    Compliance rate is based on <strong>{required_documents.join(', ')}</strong>.
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="row mb-4">
                <div className="col-md-3 col-sm-6 mb-3">
                    <div className="card metric-card border-primary">
                        <div className="card-body text-center">
                            <i className="bi bi-people metric-icon text-primary"></i>
                            <h3 className="metric-value">{metrics.total_employees}</h3>
                            <p className="metric-label">Active Employees</p>
                        </div>
                    </div>
                </div>

                <div className="col-md-3 col-sm-6 mb-3">
                    <div className="card metric-card border-success">
                        <div className="card-body text-center">
                            <i className="bi bi-shield-check metric-icon text-success"></i>
                            <h3 className="metric-value">{metrics.compliant_employees}</h3>
                            <p className="metric-label">Fully Compliant</p>
                            <div className="mt-2">
                                <span className="badge bg-success bg-opacity-10 text-success">{metrics.compliance_rate}% Rate</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-3 col-sm-6 mb-3">
                    <div className="card metric-card border-warning">
                        <div className="card-body text-center">
                            <i className="bi bi-clock-history metric-icon text-warning"></i>
                            <h3 className="metric-value">{metrics.pending_verifications}</h3>
                            <p className="metric-label">Pending Reviews</p>
                        </div>
                    </div>
                </div>

                <div className="col-md-3 col-sm-6 mb-3">
                    <div className="card metric-card border-danger">
                        <div className="card-body text-center">
                            <i className="bi bi-file-earmark-x metric-icon text-danger"></i>
                            <h3 className="metric-value">{metrics.employees_with_missing}</h3>
                            <p className="metric-label">Incomplete Files</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Required Documents Info */}
            <div className="card mb-4 border-0 shadow-sm">
                <div className="card-header bg-white py-3">
                    <h6 className="mb-0 text-muted text-uppercase small fw-bold"><i className="bi bi-check-all text-primary"></i> Mandatory Documents Required for Compliance</h6>
                </div>
                <div className="card-body">
                    <div className="d-flex flex-wrap gap-2">
                        {required_documents.map(doc => (
                            <span key={doc} className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 py-2 px-3">
                                <i className="bi bi-file-earmark-fill me-1"></i> {doc}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Employee Compliance List */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap py-3 border-bottom">
                    <h5 className="mb-2 mb-md-0 fw-bold"><i className="bi bi-person-lines-fill text-primary"></i> Employee Verification Status</h5>
                    <div className="btn-group btn-group-sm">
                        <button
                            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setFilter('all')}
                        >
                            All ({employee_list.length})
                        </button>
                        <button
                            className={`btn ${filter === 'compliant' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setFilter('compliant')}
                        >
                            Compliant ({metrics.compliant_employees})
                        </button>
                        <button
                            className={`btn ${filter === 'non-compliant' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setFilter('non-compliant')}
                        >
                            Incomplete ({employee_list.length - metrics.compliant_employees})
                        </button>
                    </div>
                </div>
                <div className="card-body p-0">
                    {filteredEmployees.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="bi bi-search" style={{ fontSize: '3rem', color: '#dee2e6' }}></i>
                            <p className="text-muted mt-3">No matching records found</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th>Emp ID</th>
                                        <th>Name</th>
                                        <th className="text-center">Docs</th>
                                        <th className="text-center">Verified</th>
                                        <th className="text-center">Pending</th>
                                        <th className="text-center">Rejected</th>
                                        <th>Missing Documents</th>
                                        <th className="text-center">Status</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.map(emp => (
                                        <React.Fragment key={emp.emp_id}>
                                            <tr onClick={() => toggleRow(emp.emp_id)} style={{ cursor: 'pointer' }}>
                                                <td className="fw-bold">
                                                    <i className={`bi bi-chevron-${expandedRows.has(emp.emp_id) ? 'down' : 'right'} me-2 text-muted`}></i>
                                                    {emp.emp_id}
                                                </td>
                                                <td className="fw-semibold text-dark">{emp.full_name}</td>
                                                <td className="text-center">
                                                    <span className="badge bg-secondary bg-opacity-10 text-secondary">{emp.total_documents}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-success bg-opacity-10 text-success">{emp.verified_count}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-warning bg-opacity-10 text-warning">{emp.pending_count}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-danger bg-opacity-10 text-danger">{emp.rejected_count}</span>
                                                </td>
                                                <td>
                                                    {emp.missing_documents.length > 0 ? (
                                                        <div className="d-flex flex-wrap gap-1">
                                                            {emp.missing_documents.map(doc => (
                                                                <span key={doc} className="badge bg-danger bg-opacity-10 text-danger small" style={{ fontSize: '0.7rem' }}>{doc}</span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-success small fw-bold">
                                                            <i className="bi bi-check2-all"></i> Clean
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    {emp.is_compliant ? (
                                                        <span className="badge bg-success rounded-pill">
                                                            VERIFIED
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-warning text-dark rounded-pill">
                                                            INCOMPLETE
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <button
                                                        className="btn btn-sm btn-light"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/employees/${emp.emp_id}/profile`)
                                                        }}
                                                    >
                                                        <i className="bi bi-pencil-square"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedRows.has(emp.emp_id) && (
                                                <tr key={`${emp.emp_id}-details`}>
                                                    <td colSpan="9" className="bg-light p-4">
                                                        <div className="card border-0 shadow-sm">
                                                            <div className="card-body p-0">
                                                                <table className="table table-sm mb-0">
                                                                    <thead className="table-dark">
                                                                        <tr>
                                                                            <th className="ps-3">Document Type</th>
                                                                            <th className="text-center">Status</th>
                                                                            <th className="text-center">Action</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {emp.documents && emp.documents.length > 0 ? (
                                                                            emp.documents.map(doc => (
                                                                                <tr key={doc.compliance_id}>
                                                                                    <td className="ps-3 fw-bold">
                                                                                        <a href={doc.doc_url} target="_blank" rel="noreferrer" className="text-decoration-none">
                                                                                            <i className="bi bi-file-earmark-pdf text-danger me-2"></i>
                                                                                            {doc.doc_type}
                                                                                        </a>
                                                                                    </td>
                                                                                    <td className="text-center">
                                                                                        {doc.status.toUpperCase() === 'PENDING' ? (
                                                                                            <span className="badge bg-warning text-dark">PENDING</span>
                                                                                        ) : doc.status.toUpperCase() === 'VERIFIED' ? (
                                                                                            <span className="badge bg-success">VERIFIED</span>
                                                                                        ) : (
                                                                                            <span className="badge bg-danger">{doc.status.toUpperCase()}</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="text-center">
                                                                                        <div className="btn-group btn-group-sm">
                                                                                            <button
                                                                                                className="btn btn-success"
                                                                                                onClick={() => handleQuickVerify(doc.compliance_id, doc.doc_type, emp.emp_id)}
                                                                                                disabled={actionLoading === `verify-${doc.compliance_id}`}
                                                                                            >
                                                                                                {actionLoading === `verify-${doc.compliance_id}` ? <span className="spinner-border spinner-border-sm"></span> : 'Verify'}
                                                                                            </button>
                                                                                            <button
                                                                                                className="btn btn-danger"
                                                                                                onClick={() => handleQuickReject(doc.compliance_id, doc.doc_type, emp.emp_id)}
                                                                                                disabled={actionLoading === `reject-${doc.compliance_id}`}
                                                                                            >
                                                                                                {actionLoading === `reject-${doc.compliance_id}` ? <span className="spinner-border spinner-border-sm"></span> : 'Reject'}
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))
                                                                        ) : (
                                                                            <tr><td colSpan="3" className="text-center py-3 text-muted italic">No documents uploaded yet</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ComplianceDashboard
