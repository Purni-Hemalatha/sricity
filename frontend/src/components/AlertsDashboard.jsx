import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { fetchAlerts, markAlertRead } from '../api/employeeApi.js'
import { Bell, Check } from 'lucide-react'

export default function AlertsDashboard() {
    const { token } = useAuth()
    const [alerts, setAlerts] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('')

    function loadAlerts() {
        if (!token) return
        setLoading(true)
        const params = {}
        if (filter) params.type = filter
        fetchAlerts(token, params)
            .then(data => { setAlerts(data.alerts || []); setUnreadCount(data.unread_count || 0) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadAlerts() }, [token, filter])

    async function handleMarkRead(id) {
        try {
            await markAlertRead(token, id)
            loadAlerts()
        } catch (e) { console.error(e) }
    }

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="mb-4">
                <h2 className="fw-bold">Alerts &amp; Reminders</h2>
                <p className="text-muted">{unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}</p>
            </div>

            <div className="mb-3">
                <select
                    className="form-select w-auto"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                >
                    <option value="">All Alerts</option>
                    <option value="compliance">Compliance</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="document">Documents</option>
                    <option value="exit">Exit</option>
                    <option value="general">General</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-5 text-muted">
                    <Bell size={48} className="mb-3 opacity-25" />
                    <h5>No alerts</h5>
                    <p>You're all caught up!</p>
                </div>
            ) : (
                <div className="d-flex flex-column gap-3">
                    {alerts.map(a => (
                        <div
                            key={a.id}
                            className={`card border-0 shadow-sm p-3 ${a.is_read ? 'opacity-60' : ''}`}
                            style={{ borderLeft: '4px solid #3377FF', borderRadius: 12 }}
                        >
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 className="fw-bold mb-1">{a.title}</h6>
                                    <p className="text-muted small mb-1">{a.message}</p>
                                    <p className="text-muted" style={{ fontSize: 12 }}>
                                        {a.emp_id} — {a.employee_name}
                                    </p>
                                </div>
                                <div className="text-end d-flex flex-column align-items-end gap-2">
                                    <small className="text-muted">{new Date(a.created_at).toLocaleDateString()}</small>
                                    {!a.is_read && (
                                        <button
                                            onClick={() => handleMarkRead(a.id)}
                                            className="btn btn-sm btn-success"
                                            title="Mark as read"
                                        >
                                            <Check size={14} /> Mark Read
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
