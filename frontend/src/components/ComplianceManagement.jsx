import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import {
    fetchComplianceIDs, createComplianceID, updateComplianceID, deleteComplianceID, fetchEmployee
} from '../api/employeeApi.js'
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react'

const COMPLIANCE_TYPES = [
    { value: 'PAN', label: 'PAN Card' },
    { value: 'AADHAAR', label: 'Aadhaar Card' },
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'DL', label: 'Driving License' },
    { value: 'VOTER_ID', label: 'Voter ID' },
]

export default function ComplianceManagement() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { token } = useAuth()
    const [employee, setEmployee] = useState(null)
    const [complianceList, setComplianceList] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        compliance_type: 'PAN',
        compliance_id: '',
        issued_date: '',
        validity_date: '',
        issuing_authority: '',
    })

    useEffect(() => {
        if (!token) return
        loadData()
    }, [token, id])

    function loadData() {
        setLoading(true)
        Promise.all([
            fetchEmployee(token, id),
            fetchComplianceIDs(token, id),
        ])
            .then(([empData, compData]) => {
                setEmployee(empData)
                setComplianceList(Array.isArray(compData) ? compData : compData.results || [])
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleAddNew = () => {
        setEditingId(null)
        setFormData({ compliance_type: 'PAN', compliance_id: '', issued_date: '', validity_date: '', issuing_authority: '' })
        setShowModal(true)
    }

    const handleEdit = (item) => {
        setEditingId(item.id)
        setFormData({
            compliance_type: item.compliance_type,
            compliance_id: item.compliance_id,
            issued_date: item.issued_date || '',
            validity_date: item.validity_date || '',
            issuing_authority: item.issuing_authority || '',
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setError(''); setSuccess('')
        try {
            if (editingId) {
                await updateComplianceID(token, editingId, formData)
                setSuccess('Compliance record updated!')
            } else {
                await createComplianceID(token, id, formData)
                setSuccess('Compliance record added!')
            }
            setShowModal(false)
            loadData()
        } catch (err) {
            setError(err.message || 'Failed to save compliance record')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (compId) => {
        if (!window.confirm('Delete this compliance record?')) return
        setError('')
        try {
            await deleteComplianceID(token, compId)
            setSuccess('Compliance record deleted!')
            loadData()
        } catch (err) {
            setError(err.message || 'Failed to delete')
        }
    }

    if (loading) return (
        <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
        </div>
    )

    return (
        <div>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div className="d-flex align-items-center gap-3">
                    <button onClick={() => navigate(`/employees/${id}/profile`)} className="btn btn-light rounded-3">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="fw-bold mb-0">Compliance Management</h2>
                        {employee && <p className="text-muted mb-0 small">#{employee.emp_id} — {employee.first_name} {employee.last_name}</p>}
                    </div>
                </div>
                <button onClick={handleAddNew} className="btn btn-success d-flex align-items-center gap-2">
                    <Plus size={18} /> Add Compliance
                </button>
            </div>

            {error && <div className="alert alert-danger rounded-3">{error}</div>}
            {success && <div className="alert alert-success rounded-3">{success}</div>}

            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                <div className="card-body p-0">
                    {complianceList.length === 0 ? (
                        <p className="text-muted text-center py-5">No compliance records found</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="ps-4">Type</th>
                                        <th>ID / Number</th>
                                        <th>Issued</th>
                                        <th>Valid Until</th>
                                        <th>Authority</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {complianceList.map(comp => (
                                        <tr key={comp.id}>
                                            <td className="ps-4 fw-bold">{comp.compliance_type_display || comp.compliance_type}</td>
                                            <td>{comp.compliance_id}</td>
                                            <td>{comp.issued_date || '—'}</td>
                                            <td>{comp.validity_date || '—'}</td>
                                            <td>{comp.issuing_authority || '—'}</td>
                                            <td className="text-center">
                                                <div className="d-flex gap-2 justify-content-center">
                                                    <button onClick={() => handleEdit(comp)} className="btn btn-sm btn-outline-primary rounded-3">
                                                        <Edit size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(comp.id)} className="btn btn-sm btn-outline-danger rounded-3">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog">
                        <div className="modal-content" style={{ borderRadius: 16, border: 'none' }}>
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title fw-bold">{editingId ? 'Edit' : 'Add'} Compliance Record</h5>
                                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Type</label>
                                        <select className="form-select" name="compliance_type" value={formData.compliance_type} onChange={handleInputChange} required>
                                            {COMPLIANCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">ID / Number</label>
                                        <input type="text" className="form-control" name="compliance_id" value={formData.compliance_id} onChange={handleInputChange} required />
                                    </div>
                                    <div className="row mb-3">
                                        <div className="col">
                                            <label className="form-label fw-semibold">Issued Date</label>
                                            <input type="date" className="form-control" name="issued_date" value={formData.issued_date} onChange={handleInputChange} />
                                        </div>
                                        <div className="col">
                                            <label className="form-label fw-semibold">Validity Date</label>
                                            <input type="date" className="form-control" name="validity_date" value={formData.validity_date} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Issuing Authority</label>
                                        <input type="text" className="form-control" name="issuing_authority" value={formData.issuing_authority} onChange={handleInputChange} />
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button type="button" className="btn btn-light rounded-3" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-3" disabled={submitting}>
                                        {submitting ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
