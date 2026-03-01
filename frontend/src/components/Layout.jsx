import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import '../styles/Layout.css'

export default function Layout({ children }) {
    const navigate = useNavigate()
    const location = useLocation()
    const { member, signOut } = useAuth()
    const [reportsOpen, setReportsOpen] = useState(
        location.pathname.startsWith('/reports') || location.pathname === '/compliance'
    )

    async function handleLogout() {
        await signOut()
        navigate('/auth')
    }

    const is = (path) => location.pathname === path
    const startsWith = (prefix) => location.pathname.startsWith(prefix)

    const initials = member?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'SE'

    return (
        <div className="hrms-shell">
            {/* ══════════ SIDEBAR ══════════ */}
            <aside className="hrms-sidebar">
                {/* Brand */}
                <div className="hrms-brand">
                    <div className="hrms-brand-icon">SE</div>
                    <span className="hrms-brand-name">Station S EMS</span>
                </div>

                {/* Navigation */}
                <nav className="hrms-nav">
                    <button
                        className={`hrms-nav-item ${is('/home') ? 'active' : ''}`}
                        onClick={() => navigate('/home')}
                    >
                        <i className="bi bi-grid-fill" /> Dashboard
                    </button>

                    <button
                        className={`hrms-nav-item ${is('/directory') ? 'active' : ''}`}
                        onClick={() => navigate('/directory')}
                    >
                        <i className="bi bi-people-fill" /> Employee Directory
                    </button>

                    <button
                        className={`hrms-nav-item ${is('/employees') ? 'active' : ''}`}
                        onClick={() => navigate('/employees')}
                    >
                        <i className="bi bi-person-plus-fill" /> Add Employee
                    </button>

                    {/* Reports group */}
                    <div className="hrms-nav-group-label">Reports</div>
                    <button
                        className={`hrms-nav-item ${is('/reports/headcount') ? 'active' : ''}`}
                        onClick={() => navigate('/reports/headcount')}
                    >
                        <i className="bi bi-bar-chart-fill" /> Headcount
                    </button>
                    <button
                        className={`hrms-nav-item ${is('/reports/joiners-leavers') ? 'active' : ''}`}
                        onClick={() => navigate('/reports/joiners-leavers')}
                    >
                        <i className="bi bi-arrow-left-right" /> Joiners &amp; Leavers
                    </button>
                    <button
                        className={`hrms-nav-item ${is('/reports/ctc') ? 'active' : ''}`}
                        onClick={() => navigate('/reports/ctc')}
                    >
                        <i className="bi bi-cash-stack" /> CTC Analytics
                    </button>
                    <button
                        className={`hrms-nav-item ${is('/compliance') ? 'active' : ''}`}
                        onClick={() => navigate('/compliance')}
                    >
                        <i className="bi bi-shield-check-fill" /> Compliance
                    </button>

                    <div className="hrms-nav-group-label">More</div>
                    <button
                        className={`hrms-nav-item ${is('/alerts') ? 'active' : ''}`}
                        onClick={() => navigate('/alerts')}
                    >
                        <i className="bi bi-bell-fill" /> Alerts
                    </button>
                </nav>

                {/* User */}
                <div className="hrms-user">
                    <div className="hrms-user-row">
                        <div className="hrms-avatar">{initials}</div>
                        <div style={{ overflow: 'hidden' }}>
                            <div className="hrms-user-name" title={member?.name}>{member?.name || 'Admin'}</div>
                            <div className="hrms-user-email" title={member?.email}>{member?.email || ''}</div>
                        </div>
                    </div>
                    <button className="hrms-logout-btn" onClick={handleLogout}>
                        <i className="bi bi-box-arrow-right" /> Logout
                    </button>
                </div>
            </aside>

            {/* ══════════ MAIN CONTENT ══════════ */}
            <main className="hrms-main">
                {children}
            </main>
        </div>
    )
}
