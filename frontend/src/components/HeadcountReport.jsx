import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { fetchHeadcountReport } from '../api/employeeApi.js'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'

/* ─── Shared Stat Card ─── */
function StatCard({ label, value, icon, color, bg }) {
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

export default function HeadcountReport() {
    const { token } = useAuth()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!token) return
        fetchHeadcountReport(token)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [token])

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="spinner-border text-primary" role="status" />
            <p style={{ marginTop: 12, color: '#9ca3af' }}>Loading headcount data…</p>
        </div>
    )

    const hc = data?.headcount || {}
    const depts = data?.departments || []

    const pieData = [
        { name: 'Active', value: hc.active || 0 },
        { name: 'Exited', value: hc.exited || 0 },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Title */}
            <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>Headcount Report</h1>
                <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>Real-time workforce strength overview</p>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'flex', gap: '1rem' }}>
                <StatCard label="Total" value={hc.total} icon="#" color="#4f46e5" bg="#ede9fe" />
                <StatCard label="Active" value={hc.active} icon="✓" color="#10b981" bg="#d1fae5" />
                <StatCard label="Exited" value={hc.exited} icon="✗" color="#ef4444" bg="#fee2e2" />
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem' }}>
                {/* Pie */}
                <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '1rem' }}>Active vs Exited</div>
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                                label={({ name, value }) => `${name}: ${value}`} labelLine>
                                <Cell fill="#10b981" />
                                <Cell fill="#ef4444" />
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Bar */}
                <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '1rem' }}>Department Breakdown</div>
                    {depts.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={depts} margin={{ bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="department" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="active" fill="#10b981" name="Active" radius={[3, 3, 0, 0]} barSize={10} />
                                <Bar dataKey="exited" fill="#ef4444" name="Exited" radius={[3, 3, 0, 0]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 60 }}>No department data</p>}
                </div>
            </div>

            {/* Table */}
            {depts.length > 0 && (
                <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                                {['DEPARTMENT', 'TOTAL', 'ACTIVE', 'EXITED'].map(h => (
                                    <th key={h} style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {depts.map((d, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: '#374151' }}>{d.department}</td>
                                    <td style={{ padding: '0.85rem 1.25rem', color: '#374151' }}>{d.total}</td>
                                    <td style={{ padding: '0.85rem 1.25rem', color: '#10b981', fontWeight: 600 }}>{d.active}</td>
                                    <td style={{ padding: '0.85rem 1.25rem', color: '#ef4444', fontWeight: 600 }}>{d.exited}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
