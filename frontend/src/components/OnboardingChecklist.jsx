import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { fetchOnboarding, updateOnboardingItem, fetchEmployee } from '../api/employeeApi.js'
import { ArrowLeft, Check } from 'lucide-react'

export default function OnboardingChecklist() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { token } = useAuth()
    const [employee, setEmployee] = useState(null)
    const [checklist, setChecklist] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [updating, setUpdating] = useState(null)

    useEffect(() => {
        if (!token) return
        loadData()
    }, [token, id])

    function loadData() {
        setLoading(true)
        Promise.all([fetchEmployee(token, id), fetchOnboarding(token, id)])
            .then(([empData, checkData]) => {
                setEmployee(empData)
                setChecklist(Array.isArray(checkData) ? checkData : checkData.results || [])
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }

    const handleCheckItem = async (item) => {
        setUpdating(item.id)
        setError(''); setSuccess('')
        try {
            await updateOnboardingItem(token, item.id, {
                is_completed: !item.is_completed,
                completed_date: !item.is_completed ? new Date().toISOString() : null,
            })
            setSuccess(`${item.item_name_display || item.item_name} ${!item.is_completed ? 'completed' : 'marked incomplete'}!`)
            loadData()
        } catch (err) {
            setError(err.message || 'Failed to update')
        } finally {
            setUpdating(null)
        }
    }

    if (loading) return (
        <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
        </div>
    )

    const completed = checklist.filter(i => i.is_completed).length
    const total = checklist.length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0

    return (
        <div>
            <div className="d-flex align-items-center gap-3 mb-4">
                <button onClick={() => navigate(`/employees/${id}/profile`)} className="btn btn-light rounded-3">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h2 className="fw-bold mb-0">Onboarding Checklist</h2>
                    {employee && <p className="text-muted mb-0 small">#{employee.emp_id} — {employee.first_name} {employee.last_name}</p>}
                </div>
            </div>

            {error && <div className="alert alert-danger rounded-3">{error}</div>}
            {success && <div className="alert alert-success rounded-3">{success}</div>}

            <div className="row g-4">
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                        <div className="card-body p-4">
                            <div className="mb-4">
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="fw-semibold">Progress</span>
                                    <span className="badge bg-primary">{progress}%</span>
                                </div>
                                <div className="progress" style={{ height: 8, borderRadius: 10 }}>
                                    <div
                                        className="progress-bar bg-success"
                                        style={{ width: `${progress}%`, borderRadius: 10 }}
                                    />
                                </div>
                                <small className="text-muted">{completed} of {total} completed</small>
                            </div>

                            {checklist.length === 0 ? (
                                <p className="text-muted text-center py-4">No checklist items found</p>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {checklist.map(item => (
                                        <div
                                            key={item.id}
                                            className="d-flex align-items-center p-3 rounded-3"
                                            style={{ background: item.is_completed ? '#f0fdf4' : '#f8fafc', cursor: 'pointer' }}
                                            onClick={() => !updating && handleCheckItem(item)}
                                        >
                                            <input
                                                type="checkbox"
                                                className="form-check-input me-3"
                                                checked={item.is_completed}
                                                onChange={() => { }}
                                                disabled={updating === item.id}
                                                style={{ width: 18, height: 18 }}
                                            />
                                            <div className="flex-grow-1">
                                                <div className={`fw-semibold ${item.is_completed ? 'text-decoration-line-through text-muted' : ''}`}>
                                                    {item.item_name_display || item.item_name}
                                                </div>
                                                {item.notes && <div className="text-muted small">{item.notes}</div>}
                                                {item.completed_date && (
                                                    <div className="text-muted small">Completed: {new Date(item.completed_date).toLocaleDateString()}</div>
                                                )}
                                            </div>
                                            {item.is_completed && <Check size={16} className="text-success ms-2" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                        <div className="card-body p-4">
                            <h6 className="fw-bold mb-3">Summary</h6>
                            {[
                                { label: 'Total Items', val: total },
                                { label: 'Completed', val: completed, color: 'text-success' },
                                { label: 'Pending', val: total - completed, color: 'text-warning' },
                                { label: 'Progress', val: `${progress}%` },
                            ].map(row => (
                                <div key={row.label} className="d-flex justify-content-between py-2 border-bottom">
                                    <span className="text-muted">{row.label}</span>
                                    <strong className={row.color || ''}>{row.val}</strong>
                                </div>
                            ))}
                            {progress === 100 && (
                                <div className="alert alert-success mt-3 mb-0 rounded-3 small">
                                    ✓ All onboarding items completed!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
