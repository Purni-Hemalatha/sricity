import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { fetchPastExperience, createPastExperience, updatePastExperience, deletePastExperience, fetchEmployee } from '../api/employeeApi.js'
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react'

export default function PastExperience() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { token } = useAuth()
    const [employee, setEmployee] = useState(null)
    const [experiences, setExperiences] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        company_name: '', designation: '', department: '',
        start_date: '', end_date: '', description: '',
    })

    useEffect(() => { if (!token) return; loadData() }, [token, id])

    function loadData() {
        setLoading(true)
        Promise.all([fetchEmployee(token, id), fetchPastExperience(token, id)])
            .then(([empData, expData]) => {
                setEmployee(empData)
                setExperiences(Array.isArray(expData) ? expData : expData.results || [])
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }

    const handleInputChange = e => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const openAdd = () => {
        setEditingId(null)
        setFormData({ company_name: '', designation: '', department: '', start_date: '', end_date: '', description: '' })
        setShowModal(true)
    }

    const openEdit = (exp) => {
        setEditingId(exp.id)
        setFormData({
            company_name: exp.company_name, designation: exp.designation,
            department: exp.department || '', start_date: exp.start_date || '',
            end_date: exp.end_date || '', description: exp.description || '',
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true); setError(''); setSuccess('')
        try {
            if (editingId) {
                await updatePastExperience(token, editingId, formData)
                setSuccess('Experience updated!')
            } else {
                await createPastExperience(token, id, formData)
                setSuccess('Experience added!')
            }
            setShowModal(false); loadData()
        } catch (err) {
            setError(err.message || 'Failed to save')
        } finally { setSubmitting(false) }
    }

    const handleDelete = async (expId) => {
        if (!window.confirm('Delete this experience record?')) return
        setError('')
        try {
            await deletePastExperience(token, expId)
            setSuccess('Experience deleted!'); loadData()
        } catch (err) { setError(err.message || 'Failed to delete') }
    }

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /></div>

    return (
        <div>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div className="d-flex align-items-center gap-3">
                    <button onClick={() => navigate(`/employees/${id}/profile`)} className="btn btn-light rounded-3">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="fw-bold mb-0">Past Experience</h2>
                        {employee && <p className="text-muted mb-0 small">#{employee.emp_id} — {employee.first_name} {employee.last_name}</p>}
                    </div>
                </div>
                <button onClick={openAdd} className="btn btn-success d-flex align-items-center gap-2">
                    <Plus size={18} /> Add Experience
                </button>
            </div>

            {error && <div className="alert alert-danger rounded-3">{error}</div>}
            {success && <div className="alert alert-success rounded-3">{success}</div>}

            <div className="d-flex flex-column gap-3">
                {experiences.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                        <p>No past experience records found.</p>
                    </div>
                ) : experiences.map(exp => (
                    <div key={exp.id} className="card border-0 shadow-sm p-4" style={{ borderRadius: 16 }}>
                        <div className="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 className="fw-bold mb-1">{exp.designation} <span className="text-muted fw-normal">at</span> {exp.company_name}</h5>
                                <p className="text-muted small mb-1">
                                    {exp.department && `${exp.department} • `}
                                    {exp.start_date} — {exp.end_date || 'Present'}
                                </p>
                                {exp.description && <p className="text-muted small mb-0">{exp.description}</p>}
                            </div>
                            <div className="d-flex gap-2 ms-3">
                                <button onClick={() => openEdit(exp)} className="btn btn-sm btn-outline-primary rounded-3">
                                    <Edit size={14} />
                                </button>
                                <button onClick={() => handleDelete(exp.id)} className="btn btn-sm btn-outline-danger rounded-3">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content" style={{ borderRadius: 16, border: 'none' }}>
                            <div className="modal-header border-0"><h5 className="modal-title fw-bold">{editingId ? 'Edit' : 'Add'} Experience</h5><button type="button" className="btn-close" onClick={() => setShowModal(false)}></button></div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="row mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold">Company Name</label>
                                            <input type="text" className="form-control" name="company_name" value={formData.company_name} onChange={handleInputChange} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold">Designation</label>
                                            <input type="text" className="form-control" name="designation" value={formData.designation} onChange={handleInputChange} required />
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Department</label>
                                        <input type="text" className="form-control" name="department" value={formData.department} onChange={handleInputChange} />
                                    </div>
                                    <div className="row mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold">Start Date</label>
                                            <input type="date" className="form-control" name="start_date" value={formData.start_date} onChange={handleInputChange} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold">End Date</label>
                                            <input type="date" className="form-control" name="end_date" value={formData.end_date} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Description</label>
                                        <textarea className="form-control" name="description" value={formData.description} onChange={handleInputChange} rows="3"></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-0">
                                    <button type="button" className="btn btn-light rounded-3" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-3" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
