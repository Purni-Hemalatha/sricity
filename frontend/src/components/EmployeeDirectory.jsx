import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Container, Row, Col, Form, Button,
  Table, Spinner, Alert, Offcanvas, Badge,
} from 'react-bootstrap'
import { httpJson } from '../api/http.js'
import 'bootstrap/dist/css/bootstrap.min.css'

/* ─────────────────────────────────────────────────────────────────────────────
   EmployeeDirectory — backed by GET /api/team38/emp-master
   Exact emp_master columns:
     emp_id (PK int)  first_name  middle_name  last_name  start_date  end_date
     status (derived: end_date IS NULL → ACTIVE, else EXITED)
───────────────────────────────────────────────────────────────────────────── */

const API = '/api/team38/emp-master'

const BLANK_FORM = {
  first_name: '',
  middle_name: '',
  last_name: '',
  start_date: '',
  end_date: '',
}

export default function EmployeeDirectory() {
  const navigate = useNavigate()

  /* ── Data ── */
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /* ── Filters / sort ── */
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('emp_id')

  /* ── Offcanvas form (Add / Edit) ── */
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)   // null = Add, number = Edit
  const [formData, setFormData] = useState(BLANK_FORM)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)

  /* ════════════════════════════════════════════════════════════
     FETCH — GET /api/team38/emp-master
  ════════════════════════════════════════════════════════════ */
  const fetchEmployees = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await httpJson(API)
      setEmployees(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load employees')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  /* ════════════════════════════════════════════════════════════
     CLIENT-SIDE FILTER + SORT
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    let result = [...employees]

    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase()
      result = result.filter(e => {
        const name = `${e.first_name || ''} ${e.middle_name || ''} ${e.last_name || ''}`.toLowerCase()
        return name.includes(s) || String(e.emp_id).includes(s)
      })
    }

    if (statusFilter !== 'ALL') {
      result = result.filter(e => e.status === statusFilter)
    }

    result.sort((a, b) => {
      if (sortBy === 'name') {
        const na = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase()
        const nb = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase()
        return na.localeCompare(nb)
      }
      if (sortBy === 'start_date') return new Date(b.start_date) - new Date(a.start_date)
      return a.emp_id - b.emp_id   // default: emp_id ASC
    })

    setFilteredEmployees(result)
  }, [employees, searchTerm, statusFilter, sortBy])

  /* ════════════════════════════════════════════════════════════
     FORM HELPERS
  ════════════════════════════════════════════════════════════ */
  const resetForm = () => {
    setFormData(BLANK_FORM)
    setFormError(null); setFormSuccess(null)
    setEditingId(null); setShowForm(false)
  }

  const openAdd = () => {
    setFormData(BLANK_FORM)
    setFormError(null); setFormSuccess(null)
    setEditingId(null); setShowForm(true)
  }

  const openEdit = (emp) => {
    setFormData({
      first_name: emp.first_name || '',
      middle_name: emp.middle_name || '',
      last_name: emp.last_name || '',
      start_date: emp.start_date || '',
      end_date: emp.end_date || '',
    })
    setFormError(null); setFormSuccess(null)
    setEditingId(emp.emp_id)
    setShowForm(true)
  }

  const handleInputChange = e => {
    const { name, value } = e.target
    setFormData(p => ({ ...p, [name]: value }))
  }

  /* ════════════════════════════════════════════════════════════
     SUBMIT — Add (POST) or Edit (PUT)
  ════════════════════════════════════════════════════════════ */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null); setFormSuccess(null)

    const { first_name, last_name, start_date } = formData
    if (!first_name.trim() || !last_name.trim() || !start_date) {
      setFormError('first_name, last_name and start_date are required')
      return
    }

    try {
      setFormLoading(true)
      const body = {
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() || null,
        last_name: formData.last_name.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
      }

      if (editingId) {
        await httpJson(`${API}/${editingId}`, { method: 'PUT', body })
        setFormSuccess('Employee updated successfully!')
      } else {
        await httpJson(API, { method: 'POST', body })
        setFormSuccess('Employee added successfully!')
        setFormData(BLANK_FORM)
      }
      await fetchEmployees()
    } catch (err) {
      setFormError(err.message || 'Save failed')
    } finally {
      setFormLoading(false)
    }
  }

  /* ════════════════════════════════════════════════════════════
     EXIT — sets end_date to today
  ════════════════════════════════════════════════════════════ */
  const handleExit = async (emp) => {
    if (!window.confirm(`Mark "${emp.first_name} ${emp.last_name}" as EXITED?`)) return
    try {
      const today = new Date().toISOString().split('T')[0]
      await httpJson(`${API}/${emp.emp_id}/exit`, {
        method: 'POST', body: { end_date: today },
      })
      await fetchEmployees()
    } catch (err) {
      setError(err.message || 'Failed to mark as exited')
    }
  }

  /* ════════════════════════════════════════════════════════════
     DELETE
  ════════════════════════════════════════════════════════════ */
  const handleDelete = async (emp) => {
    if (!window.confirm(`Permanently delete "${emp.first_name} ${emp.last_name}"?\nThis cannot be undone.`)) return
    try {
      await httpJson(`${API}/${emp.emp_id}`, { method: 'DELETE' })
      await fetchEmployees()
    } catch (err) {
      setError(err.message || 'Delete failed')
    }
  }

  /* ════════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════════ */
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—'

  const StatusBadge = ({ status }) =>
    status === 'ACTIVE'
      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: '20px', padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /> ACTIVE
      </span>
      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#F3F4F6', color: '#6B7280', border: '1px solid #D1D5DB', borderRadius: '20px', padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', display: 'inline-block' }} /> EXITED
      </span>

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>

      {/* ── Stats Header ── */}
      <div className="mb-4 d-flex justify-content-end">
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[
            { label: 'Total', val: employees.length, bg: '#F0FDF4', color: '#16a34a' },
            { label: 'Active', val: employees.filter(e => e.status === 'ACTIVE').length, bg: '#EEF3FF', color: '#3377FF' },
            { label: 'Exited', val: employees.filter(e => e.status === 'EXITED').length, bg: '#F3F4F6', color: '#6B7280' },
          ].map(({ label, val, bg, color }) => (
            <div key={label} style={{ background: bg, borderRadius: '12px', padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1 }}>{val}</span>
              <span style={{ fontSize: '0.6rem', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alert ── */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
          ⚠️ {error}
        </Alert>
      )}

      {/* ── Filter bar ── */}
      <div className="mb-4 p-4" style={{ background: 'white', borderRadius: '16px', border: '1px solid #E8EAF0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Row className="g-3 align-items-end">

          {/* Search — emp_id / name */}
          <Col lg={4} md={12}>
            <Form.Label style={labelStyle}>Search (name / emp ID)</Form.Label>
            <Form.Control
              type="text" placeholder="e.g. John, 210001 …"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={inputStyle}
            />
          </Col>

          {/* Status */}
          <Col lg={2} md={4}>
            <Form.Label style={labelStyle}>Status</Form.Label>
            <Form.Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="EXITED">Exited</option>
            </Form.Select>
          </Col>

          {/* Sort */}
          <Col lg={2} md={4}>
            <Form.Label style={labelStyle}>Sort By</Form.Label>
            <Form.Select value={sortBy} onChange={e => setSortBy(e.target.value)} style={inputStyle}>
              <option value="emp_id">Employee ID</option>
              <option value="name">Name</option>
              <option value="start_date">Start Date (Newest)</option>
            </Form.Select>
          </Col>

          {/* Actions */}
          <Col lg={4} md={4} className="d-flex gap-2">
            <Button
              variant="primary" onClick={openAdd} className="w-100"
              style={{ borderRadius: '10px', padding: '0.65rem 1rem', fontWeight: 700, fontSize: '0.88rem', boxShadow: '0 4px 12px rgba(51,119,255,0.3)', whiteSpace: 'nowrap' }}
            >
              + Add Employee
            </Button>
            <Button
              variant="light" onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); setSortBy('emp_id') }}
              title="Reset filters"
              style={{ borderRadius: '10px', padding: '0.65rem 0.85rem', fontWeight: 600, fontSize: '1rem', flexShrink: 0, border: '1.5px solid #E8EAF0', color: '#6B7588' }}
            >
              ↺
            </Button>
            <Button
              variant="light" onClick={fetchEmployees}
              title="Refresh from DB"
              style={{ borderRadius: '10px', padding: '0.65rem 0.85rem', fontWeight: 600, fontSize: '1rem', flexShrink: 0, border: '1.5px solid #E8EAF0', color: '#6B7588' }}
            >
              ⟳
            </Button>
          </Col>
        </Row>

        {/* Result count */}
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F0F0F5' }}>
          <p className="mb-0" style={{ color: '#8F90A6', fontWeight: 500, fontSize: '0.85rem' }}>
            Showing <strong style={{ color: '#1A1D2E' }}>{filteredEmployees.length}</strong> of{' '}
            <strong style={{ color: '#1A1D2E' }}>{employees.length}</strong> employees
          </p>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E8EAF0', overflow: 'hidden' }}>
        {loading ? (
          <div className="text-center py-5" style={{ background: 'linear-gradient(135deg,#F8FAFC 0%,#F0F4FF 100%)' }}>
            <Spinner animation="border" style={{ color: '#3377FF' }} />
            <p className="mt-3" style={{ color: '#6B7588', fontWeight: 500 }}>Loading employees…</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-5" style={{ background: 'linear-gradient(135deg,#F8FAFC 0%,#F0F4FF 100%)' }}>
            <h5 style={{ color: '#6B7588', fontWeight: 700 }}>📭 No employees found</h5>
            <p style={{ color: '#8F90A6', marginTop: '0.5rem' }}>
              {searchTerm || statusFilter !== 'ALL'
                ? 'Try adjusting your search or filters'
                : 'Add your first employee using the button above'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table className="mb-0">
              <thead>
                <tr style={{ background: '#F7F8FC', borderBottom: '2px solid #E8EAF0' }}>
                  {[
                    ['Employee ID', '8%'],
                    ['First Name', '14%'],
                    ['Middle Name', '12%'],
                    ['Last Name', '14%'],
                    ['Start Date', '11%'],
                    ['End Date', '11%'],
                    ['Status', '10%'],
                    ['Actions', '12%'],
                  ].map(([col, w]) => (
                    <th key={col} style={{ padding: '0.9rem 1.1rem', color: '#8F90A6', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.7px', borderBottom: 'none', whiteSpace: 'nowrap', width: w, textAlign: col === 'Actions' || col === 'Status' ? 'center' : 'left' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr
                    key={emp.emp_id}
                    style={{ borderBottom: '1px solid #F0F0F5', transition: 'background 0.12s', opacity: emp.status === 'EXITED' ? 0.65 : 1 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F7F9FF'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* emp_id */}
                    <td style={{ padding: '0.9rem 1.1rem', fontWeight: 700, color: '#3377FF', fontSize: '0.88rem', letterSpacing: '0.3px' }}>
                      {emp.emp_id}
                    </td>
                    {/* first_name */}
                    <td style={{ padding: '0.9rem 1.1rem', fontWeight: 600, color: '#1A1D2E', fontSize: '0.9rem' }}>
                      {emp.first_name || '—'}
                    </td>
                    {/* middle_name */}
                    <td style={{ padding: '0.9rem 1.1rem', color: '#6B7588', fontSize: '0.88rem' }}>
                      {emp.middle_name || <span style={{ color: '#C5C7D4' }}>—</span>}
                    </td>
                    {/* last_name */}
                    <td style={{ padding: '0.9rem 1.1rem', fontWeight: 600, color: '#1A1D2E', fontSize: '0.9rem' }}>
                      {emp.last_name || '—'}
                    </td>
                    {/* start_date */}
                    <td style={{ padding: '0.9rem 1.1rem', color: '#6B7588', fontSize: '0.88rem' }}>
                      {fmt(emp.start_date)}
                    </td>
                    {/* end_date */}
                    <td style={{ padding: '0.9rem 1.1rem', color: '#6B7588', fontSize: '0.88rem' }}>
                      {emp.end_date
                        ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{fmt(emp.end_date)}</span>
                        : <span style={{ color: '#C5C7D4' }}>—</span>}
                    </td>
                    {/* status */}
                    <td style={{ padding: '0.75rem 1.1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <StatusBadge status={emp.status} />
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        {/* View Profile */}
                        <ActionBtn
                          title="View full profile"
                          emoji="👤"
                          bg="#F0F4FF" color="#3377FF" hoverBg="#3377FF"
                          onClick={() => navigate(`/employees/${emp.emp_id}/profile`)}
                        />
                        {/* Edit */}
                        <ActionBtn
                          title="Edit employee"
                          emoji="✎"
                          bg="#F0F4FF" color="#3377FF" hoverBg="#3377FF"
                          onClick={() => openEdit(emp)}
                        />
                        {/* Exit / Re-activate toggle */}
                        {emp.status === 'EXITED' ? (
                          <ActionBtn
                            title="Re-activate (clear end_date)"
                            emoji="↩"
                            bg="#F0FDF4" color="#16a34a" hoverBg="#16a34a"
                            onClick={async () => {
                              try {
                                await httpJson(`${API}/${emp.emp_id}`, {
                                  method: 'PUT',
                                  body: { first_name: emp.first_name, middle_name: emp.middle_name || null, last_name: emp.last_name, start_date: emp.start_date, end_date: null },
                                })
                                await fetchEmployees()
                              } catch (err) { setError(err.message) }
                            }}
                          />
                        ) : (
                          <ActionBtn
                            title="Mark as Exited (sets end_date = today)"
                            emoji="⏹"
                            bg="#FFF1F1" color="#E53935" hoverBg="#E53935"
                            onClick={() => handleExit(emp)}
                          />
                        )}
                        {/* Delete */}
                        <ActionBtn
                          title="Delete permanently"
                          emoji="🗑"
                          bg="#FFF1F1" color="#E53935" hoverBg="#E53935"
                          onClick={() => handleDelete(emp)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="mt-3 text-center">
        <p style={{ color: '#B0B3C6', fontSize: '0.82rem' }}>
          {filteredEmployees.length} of {employees.length} employee{employees.length !== 1 ? 's' : ''} shown
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Offcanvas: Add / Edit Employee (emp_master columns only)
      ══════════════════════════════════════════════════════════ */}
      <Offcanvas show={showForm} onHide={resetForm} placement="end" style={{ width: 440 }}>
        <Offcanvas.Header closeButton style={{ background: 'linear-gradient(135deg,#3377FF 0%,#2659BF 100%)', color: 'white' }}>
          <Offcanvas.Title style={{ fontWeight: 700 }}>
            {editingId ? `✏️ Edit Employee: ${editingId}` : '➕ Add New Employee'}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body style={{ padding: '2rem' }}>
          <p style={{ fontSize: '0.82rem', color: '#8F90A6', marginBottom: '1.5rem' }}>
            Enter employee information below
          </p>

          {formError && <Alert variant="danger" dismissible onClose={() => setFormError(null)} className="mb-3">{formError}</Alert>}
          {formSuccess && <Alert variant="success" dismissible onClose={() => setFormSuccess(null)} className="mb-3">{formSuccess}</Alert>}

          <Form onSubmit={handleSubmit}>
            {/* first_name */}
            <Form.Group className="mb-3">
              <Form.Label style={fieldLabel}>First Name <span style={{ color: '#E53935' }}>*</span></Form.Label>
              <Form.Control
                type="text" name="first_name" placeholder="e.g. Aarav"
                value={formData.first_name} onChange={handleInputChange} required
                style={fieldInput}
              />
            </Form.Group>

            {/* middle_name */}
            <Form.Group className="mb-3">
              <Form.Label style={fieldLabel}>Middle Name <span style={{ color: '#8F90A6', fontWeight: 400 }}>(optional)</span></Form.Label>
              <Form.Control
                type="text" name="middle_name" placeholder="e.g. Kumar"
                value={formData.middle_name} onChange={handleInputChange}
                style={fieldInput}
              />
            </Form.Group>

            {/* last_name */}
            <Form.Group className="mb-3">
              <Form.Label style={fieldLabel}>Last Name <span style={{ color: '#E53935' }}>*</span></Form.Label>
              <Form.Control
                type="text" name="last_name" placeholder="e.g. Sharma"
                value={formData.last_name} onChange={handleInputChange} required
                style={fieldInput}
              />
            </Form.Group>

            {/* start_date */}
            <Form.Group className="mb-3">
              <Form.Label style={fieldLabel}>Start Date <span style={{ color: '#E53935' }}>*</span></Form.Label>
              <Form.Control
                type="date" name="start_date"
                value={formData.start_date} onChange={handleInputChange} required
                style={fieldInput}
              />
              <Form.Text className="text-muted">Date of joining</Form.Text>
            </Form.Group>

            {/* end_date */}
            <Form.Group className="mb-4">
              <Form.Label style={fieldLabel}>End Date <span style={{ color: '#8F90A6', fontWeight: 400 }}>(optional)</span></Form.Label>
              <Form.Control
                type="date" name="end_date"
                value={formData.end_date} onChange={handleInputChange}
                style={fieldInput}
              />
              <Form.Text className="text-muted">Leave blank for Active employees</Form.Text>
            </Form.Group>

            <div style={{ background: '#F7F8FC', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#6B7588', fontWeight: 600 }}>
              <div><strong>Employee ID</strong>: {editingId || '(auto-generated)'}</div>
              <div><strong>Status</strong>: {formData.end_date ? '🔴 EXITED' : '🟢 ACTIVE'}</div>
            </div>

            <Button
              variant="primary" type="submit" className="w-100"
              disabled={formLoading}
              style={{ borderRadius: '10px', padding: '0.875rem', fontWeight: 700 }}
            >
              {formLoading
                ? <><Spinner as="span" animation="border" size="sm" className="me-2" />{editingId ? 'Saving…' : 'Creating…'}</>
                : editingId ? '✓ Save Changes' : '✓ Create Employee'}
            </Button>
          </Form>
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  )
}

/* ─── Tiny reusable action button ─────────────────────────────────────────── */
function ActionBtn({ title, emoji, bg, color, hoverBg, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: hovered ? hoverBg : bg,
        color: hovered ? 'white' : color,
        border: 'none', borderRadius: '8px',
        padding: '0.4rem 0.55rem',
        cursor: 'pointer', fontSize: '0.82rem',
        fontWeight: 700, lineHeight: 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {emoji}
    </button>
  )
}

/* ─── Shared style constants ───────────────────────────────────────────────── */
const labelStyle = {
  fontWeight: 600, fontSize: '0.75rem',
  textTransform: 'uppercase', letterSpacing: '0.7px',
  color: '#8F90A6', marginBottom: '0.45rem',
}

const inputStyle = {
  borderRadius: '10px', padding: '0.65rem 1rem',
  border: '1.5px solid #E8EAF0', fontSize: '0.9rem', background: '#FAFAFA',
}

const fieldLabel = {
  fontWeight: 600, color: '#3A3A3C',
  fontSize: '0.85rem', marginBottom: '0.35rem',
}

const fieldInput = {
  borderRadius: '10px', padding: '0.875rem',
  border: '2px solid #EBEBF0',
}
