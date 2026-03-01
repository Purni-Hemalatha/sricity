import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { fetchCTCReport } from '../api/employeeApi.js'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const BAND_COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
const LEVEL_COLORS = [
    '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
    '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
]

export default function CTCReport() {
    const { token } = useAuth()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!token) return
        fetchCTCReport(token)
            .then(setData)
            .catch(e => setError(e.message || 'Failed to load CTC report'))
            .finally(() => setLoading(false))
    }, [token])

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="spinner-border text-primary" role="status" />
            <p style={{ marginTop: 12, color: '#9ca3af' }}>Loading CTC data…</p>
        </div>
    )

    if (error) return (
        <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', marginBottom: 8 }}>CTC &amp; Level Distribution</h1>
            <div style={{ background: '#fff', borderRadius: 16, padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
                <p>Error loading report</p>
                <p style={{ fontSize: '0.9rem', color: '#ef4444', marginTop: 4 }}>{error}</p>
                <p style={{ fontSize: '0.82rem', marginTop: 12 }}>Check backend logs or verify that CTC info has been added to employees.</p>
            </div>
        </div>
    )

    const bands = data?.salary_bands || []
    const levels = data?.levels || []
    const totalWithCtc = data?.total_with_ctc || 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Title */}
            <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>CTC &amp; Level Distribution</h1>
                <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>
                    Salary band breakdown and employee level analytics
                    {totalWithCtc > 0 && ` • ${totalWithCtc} employees with CTC data`}
                </p>
            </div>

            {/* Charts row */}
            <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem' }}>
                    {/* Salary Band Bar */}
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '1rem' }}>Salary Band Distribution</div>
                        {bands.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={bands}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                    <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(v) => [v, 'Employees']} />
                                    <Bar dataKey="count" name="Employees" radius={[4, 4, 0, 0]}>
                                        {bands.map((_, i) => <Cell key={i} fill={BAND_COLORS[i % BAND_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p style={{ color: '#9ca3af', textAlign: 'center', paddingTop: 80 }}>No salary band data</p>}
                    </div>

                    {/* Level Pie */}
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '1rem' }}>Level Distribution</div>
                        {levels.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={levels} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={100}
                                        label={({ level, count }) => `${level} (${count})`} labelLine>
                                        {levels.map((_, i) => <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v, n) => [v, n]} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <p style={{ color: '#9ca3af', textAlign: 'center', paddingTop: 80 }}>No level data</p>}
                    </div>
                </div>
            </div>

            {/* Two tables side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {/* Salary Band Table */}
                <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px' }}>SALARY BAND</th>
                                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px' }}>EMPLOYEES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bands.map((b, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                                    <td style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: '#374151' }}>{b.band}</td>
                                    <td style={{ padding: '0.75rem 1.25rem', color: '#374151' }}>{b.count}</td>
                                </tr>
                            ))}
                            {bands.length === 0 && (
                                <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Level Table */}
                <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px' }}>LEVEL</th>
                                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px' }}>EMPLOYEES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {levels.map((l, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                                    <td style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: '#374151' }}>{l.level}</td>
                                    <td style={{ padding: '0.75rem 1.25rem', color: '#374151' }}>{l.count}</td>
                                </tr>
                            ))}
                            {levels.length === 0 && (
                                <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
