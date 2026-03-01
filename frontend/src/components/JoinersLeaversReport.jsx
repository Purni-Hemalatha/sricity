import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { fetchJoinersLeaversReport } from '../api/employeeApi.js'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend
} from 'recharts'

function StatCard({ label, value, icon, color, bg }) {
    const net = typeof value === 'number' && value >= 0
    return (
        <div style={{
            background: 'white', borderRadius: 16, padding: '1.5rem 1.75rem',
            flex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
            <div style={{
                width: 32, height: 32, borderRadius: 8, background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, fontWeight: 800, fontSize: '1rem', marginBottom: 10,
            }}>{icon}</div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9ca3af', marginBottom: 6 }}>
                {label}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#111827', letterSpacing: '-2px', lineHeight: 1 }}>
                {value ?? '—'}
            </div>
        </div>
    )
}

export default function JoinersLeaversReport() {
    const { token } = useAuth()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!token) return
        fetchJoinersLeaversReport(token)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [token])

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="spinner-border text-primary" role="status" />
            <p style={{ marginTop: 12, color: '#9ca3af' }}>Loading report…</p>
        </div>
    )

    const timeline = data?.timeline || []
    const totalJoiners = data?.total_joiners || 0
    const totalLeavers = data?.total_leavers || 0
    const netChange = totalJoiners - totalLeavers

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Title */}
            <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>Joiners &amp; Leavers Report</h1>
                <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>Monthly hiring and attrition trends</p>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'flex', gap: '1rem' }}>
                <StatCard label="Total Joiners" value={totalJoiners} icon="+" color="#10b981" bg="#d1fae5" />
                <StatCard label="Total Leavers" value={totalLeavers} icon="−" color="#ef4444" bg="#fee2e2" />
                <StatCard label="Net Change" value={netChange} icon="Δ" color="#06b6d4" bg="#cffafe" />
            </div>

            {/* Full-width bar chart */}
            {timeline.length > 0 ? (
                <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '1.25rem' }}>Monthly Trend</div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={timeline} margin={{ left: 0, right: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="month" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="joiners" fill="#10b981" name="Joiners" radius={[2, 2, 0, 0]} maxBarSize={12} />
                            <Bar dataKey="leavers" fill="#ef4444" name="Leavers" radius={[2, 2, 0, 0]} maxBarSize={12} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: 16, padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    No joiner/leaver data yet.
                </div>
            )}

            {/* Table */}
            {timeline.length > 0 && (
                <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                                {['MONTH', 'JOINERS', 'LEAVERS', 'NET'].map(h => (
                                    <th key={h} style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {timeline.map((t, i) => {
                                const net = t.joiners - t.leavers
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                                        <td style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: '#374151' }}>{t.month}</td>
                                        <td style={{ padding: '0.75rem 1.25rem', color: '#10b981', fontWeight: 600 }}>{t.joiners}</td>
                                        <td style={{ padding: '0.75rem 1.25rem', color: '#ef4444', fontWeight: 600 }}>{t.leavers}</td>
                                        <td style={{ padding: '0.75rem 1.25rem', fontWeight: 700, color: net >= 0 ? '#10b981' : '#ef4444' }}>
                                            {net >= 0 ? '+' : ''}{net}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
