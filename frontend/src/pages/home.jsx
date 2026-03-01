import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { httpJson } from '../api/http.js'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const DEPT_COLORS = [
  '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#e11d48',
]

export default function HomePage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [stats, setStats] = useState({
    total: 0, active: 0, exited: 0, recentJoiners: 0,
    pendingDocs: 0, pendingCompliance: 0, onboardingPending: 0, unreadAlerts: 0,
  })
  const [deptData, setDeptData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    loadDashboard()
  }, [token])

  async function loadDashboard() {
    setLoading(true)
    try {
      const empList = await httpJson('/api/team38/emp-master', { token }).catch(() => [])
      const arr = Array.isArray(empList) ? empList : []
      const active = arr.filter(e => e.status === 'ACTIVE').length
      const exited = arr.filter(e => e.status === 'EXITED').length
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
      const recentJoiners = arr.filter(e => e.start_date && new Date(e.start_date) >= cutoff).length

      const cDash = await httpJson('/api/team38/compliance-dashboard', { token }).catch(() => null)
      const pendingCompliance = cDash?.summary?.pending ?? cDash?.pending_count ?? 0
      const pendingDocs = cDash?.summary?.missing ?? cDash?.missing_count ?? 0

      const alertsData = await httpJson('/api/team38/alerts', { token }).catch(() => null)
      const unreadAlerts = alertsData?.unread_count ?? 0

      const hcData = await httpJson('/api/team38/reports/headcount', { token }).catch(() => null)
      const depts = (hcData?.departments || [])
        .map((d, i) => ({ name: d.department || `Dept ${i + 1}`, value: d.total || d.active || 0 }))
        .filter(d => d.value > 0)

      setStats({ total: arr.length, active, exited, recentJoiners, pendingDocs, pendingCompliance, onboardingPending: 0, unreadAlerts })
      setDeptData(depts)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const topStats = [
    { label: 'Total Employees', value: stats.total, icon: 'bi-people-fill', color: '#4f46e5' },
    { label: 'Active', value: stats.active, icon: 'bi-person-check-fill', color: '#10b981' },
    { label: 'Exited', value: stats.exited, icon: 'bi-person-x-fill', color: '#ef4444' },
    { label: 'Recent Joiners', value: stats.recentJoiners, icon: 'bi-person-plus-fill', color: '#8b5cf6' },
    { label: 'Pending Documents', value: stats.pendingDocs, icon: 'bi-file-earmark-text-fill', color: '#f59e0b' },
  ]

  const midStats = [
    { label: 'Pending Compliance', value: stats.pendingCompliance, icon: 'bi-shield-exclamation', color: '#4f46e5' },
    { label: 'Onboarding Pending', value: stats.onboardingPending, icon: 'bi-clipboard2-check-fill', color: '#f59e0b' },
    { label: 'Unread Alerts', value: stats.unreadAlerts, icon: 'bi-bell-fill', color: '#ef4444' },
  ]

  const StatCard = ({ label, value, icon, color }) => (
    <div style={{
      background: 'white', borderRadius: 14, padding: '1.1rem 1.25rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9ca3af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className={`bi ${icon}`} style={{ color }} /> {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', letterSpacing: '-1px', lineHeight: 1 }}>
        {loading ? <span style={{ fontSize: '1.2rem', color: '#d1d5db' }}>—</span> : value}
      </div>
    </div>
  )

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>Dashboard</h1>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: 2 }}>Welcome back! Here's your HR overview.</p>
      </div>

      {/* Top 5 stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        {topStats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Mid 3 stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
        {midStats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Chart + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem' }}>
        {/* Pie Chart */}
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem 0.75rem', fontWeight: 700, fontSize: '1rem', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
            Department Distribution
          </div>
          <div style={{ padding: '1.25rem 1.5rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                <div className="spinner-border spinner-border-sm" role="status" />
                <div style={{ marginTop: 8, fontSize: '0.85rem' }}>Loading…</div>
              </div>
            ) : deptData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.9rem' }}>
                No department data available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name, value }) => `${name} (${value})`} labelLine>
                    {deptData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', alignSelf: 'start' }}>
          <div style={{ padding: '1.25rem 1.5rem 0.75rem', fontWeight: 700, fontSize: '1rem', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
            Quick Actions
          </div>
          <div style={{ padding: '1.25rem 1.5rem' }}>
            {[
              { label: 'Add New Employee', path: '/employees', icon: 'bi-person-plus-fill', primary: true },
              { label: 'View Directory', path: '/directory', icon: 'bi-people-fill' },
              { label: `View Alerts${stats.unreadAlerts > 0 ? ` (${stats.unreadAlerts})` : ''}`, path: '/alerts', icon: 'bi-bell-fill' },
              { label: 'Headcount Report', path: '/reports/headcount', icon: 'bi-bar-chart-fill' },
              { label: 'Compliance Status', path: '/compliance', icon: 'bi-shield-check-fill' },
              { label: 'Joiners & Leavers', path: '/reports/joiners-leavers', icon: 'bi-graph-up-arrow' },
            ].map(btn => (
              <button
                key={btn.path}
                onClick={() => navigate(btn.path)}
                style={{
                  width: '100%', padding: '0.7rem 1rem', borderRadius: 10,
                  border: btn.primary ? 'none' : '1.5px solid #e5e7eb',
                  background: btn.primary ? '#4f46e5' : 'white',
                  color: btn.primary ? 'white' : '#374151',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: '0.5rem', transition: 'all 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                <i className={`bi ${btn.icon}`} /> {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
