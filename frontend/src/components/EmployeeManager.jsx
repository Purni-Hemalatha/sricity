import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { Container, Row, Col, Button, Card, Form, Table, Alert, Modal, Badge, Spinner, Offcanvas } from 'react-bootstrap'
import { httpJson } from '../api/http.js'
import 'bootstrap/dist/css/bootstrap.min.css'
import '../styles/EmployeeManager.css'

export default function EmployeeManager() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [exitingId, setExitingId] = useState(null)
  const [exitDate, setExitDate] = useState('')

  const [formData, setFormData] = useState({
    emp_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    joining_date: '',
  })

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  /* ════════════════════════════════════════════════════════════
     FETCH — GET /api/team38/emp-master
  ════════════════════════════════════════════════════════════ */
  const fetchEmployees = async () => {
    if (!token) return
    try {
      setLoading(true)
      const data = await httpJson('/api/team38/emp-master', { token })
      setEmployees(data || [])
      clearMessages()
    } catch (err) {
      setError(err.message || 'Failed to load employees')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [token])

  const resetForm = () => {
    setFormData({
      emp_id: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      phone: '',
      department: '',
      designation: '',
      joining_date: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMessages()

    if (!formData.first_name || !formData.last_name || !formData.joining_date) {
      setError('Please fill all required fields')
      return
    }

    try {
      setLoading(true)
      const payload = { ...formData, start_date: formData.joining_date }

      if (editingId) {
        await httpJson(`/api/team38/emp-master/${editingId}`, {
          method: 'PUT',
          token,
          body: payload,
        })
        setSuccess('Employee updated successfully!')
      } else {
        await httpJson('/api/team38/emp-master', {
          method: 'POST',
          token,
          body: payload,
        })
        setSuccess('Employee created successfully!')
      }
      await fetchEmployees()
      resetForm()
    } catch (err) {
      setError(err.message || 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (emp) => {
    setFormData({
      emp_id: emp.emp_id,
      first_name: emp.first_name,
      middle_name: emp.middle_name || '',
      last_name: emp.last_name,
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || '',
      designation: emp.designation || '',
      joining_date: emp.start_date || '',
    })
    setEditingId(emp.emp_id)
    setShowForm(true)
  }

  const handleExitClick = (emp) => {
    setExitingId(emp.emp_id)
    setExitDate('')
  }

  const handleExitSubmit = async () => {
    clearMessages()
    if (!exitDate) {
      setError('Please select an exit date')
      return
    }

    try {
      setLoading(true)
      await httpJson(`/api/team38/emp-master/${exitingId}/exit`, {
        method: 'POST',
        token,
        body: { exit_date: exitDate },
      })
      setSuccess('Employee exited successfully!')
      await fetchEmployees()
      setExitingId(null)
      setExitDate('')
    } catch (err) {
      setError(err.message || 'Exit operation failed')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '--'
    return new Date(dateString).toLocaleDateString('en-IN')
  }

  return (
    <Container className="py-5">
      {/* Header Section */}
      <Row className="mb-4 align-items-center">
        <Col>
          <h1 className="mb-2">Employee Management</h1>
          <p className="text-muted">Create, update, and manage employee records</p>
        </Col>
        <Col xs="auto">
          <Button
            variant={showForm ? "secondary" : "primary"}
            size="lg"
            onClick={() => setShowForm(!showForm)}
            disabled={loading}
          >
            {showForm ? '✕ Cancel' : '+ Add Employee'}
          </Button>
        </Col>
      </Row>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={clearMessages} className="mb-4">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}

      {success && (
        <Alert variant="success" dismissible onClose={clearMessages} className="mb-4">
          <Alert.Heading>Success!</Alert.Heading>
          <p>{success}</p>
        </Alert>
      )}



      {/* Employee List Section */}
      <Card className="shadow-sm border-0">
        <Card.Header className="bg-light d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            📋 Employee List <Badge bg="secondary">{employees.length}</Badge>
          </h5>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={fetchEmployees}
            disabled={loading}
          >
            ⟲ Refresh
          </Button>
        </Card.Header>
        <Card.Body>
          {loading && employees.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" className="mb-3">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="text-muted">Loading employees...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-5">
              <h5 className="text-muted">📭 No employees found</h5>
              <p className="text-muted small">Start by adding your first employee</p>
            </div>
          ) : (
            <Table hover responsive className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Joining Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.emp_id} className={emp.status === 'EXITED' ? 'opacity-50' : ''}>
                    <td className="fw-bold">{emp.emp_id}</td>
                    <td>
                      <div>
                        <strong>{emp.first_name} {emp.last_name}</strong>
                        {emp.designation && <div className="small text-muted">{emp.designation}</div>}
                      </div>
                    </td>
                    <td>{emp.email}</td>
                    <td>{emp.department || '—'}</td>
                    <td>{formatDate(emp.start_date)}</td>
                    <td>
                      {emp.status === 'ACTIVE' ? (
                        <Badge bg="success">ACTIVE</Badge>
                      ) : (
                        <Badge bg="secondary">EXITED</Badge>
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button
                          variant="info"
                          size="sm"
                          onClick={() => navigate(`/employees/${emp.emp_id}/profile`)}
                          title="View full profile with edit"
                        >
                          👤
                        </Button>
                        {emp.status === 'ACTIVE' && (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleExitClick(emp)}
                              title="Exit employee"
                            >
                              🚪
                            </Button>
                            <Button
                              variant="warning"
                              size="sm"
                              onClick={() => handleEdit(emp)}
                              title="Edit employee"
                            >
                              ✎
                            </Button>
                          </>
                        )}
                      </div>
                      {emp.status === 'EXITED' && emp.exit_date && (
                        <small className="text-muted">Exited: {formatDate(emp.exit_date)}</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Exit Modal */}
      <Modal show={!!exitingId} onHide={() => setExitingId(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>🚪 Exit Employee</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Please select the exit date for this employee:</p>
          <Form.Group>
            <Form.Control
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setExitingId(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleExitSubmit}
            disabled={loading || !exitDate}
          >
            {loading ? 'Processing...' : 'Confirm Exit'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Form Sidebar (Offcanvas) */}
      <Offcanvas
        show={showForm}
        onHide={resetForm}
        placement="end"
        style={{ width: '500px' }}
      >
        <Offcanvas.Header closeButton style={{ background: 'linear-gradient(135deg, #3377FF 0%, #2659BF 100%)', color: 'white' }}>
          <Offcanvas.Title style={{ fontWeight: 700 }}>
            {editingId ? '✎ Edit Employee' : '➕ Add New Employee'}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body style={{ padding: '2rem' }}>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={12} className="mb-3">
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: '#3A3A3C', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                    Employee ID <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="emp_id"
                    placeholder="e.g., EMP001"
                    value={formData.emp_id}
                    onChange={handleInputChange}
                    disabled={!!editingId}
                    required
                    style={{ borderRadius: '10px', padding: '0.875rem', border: '2px solid #EBEBF0' }}
                  />
                </Form.Group>
              </Col>

              <Col md={12} className="mb-3">
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: '#3A3A3C', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                    Email <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    placeholder="employee@company.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    style={{ borderRadius: '10px', padding: '0.875rem', border: '2px solid #EBEBF0' }}
                  />
                </Form.Group>
              </Col>

              <Col md={6} className="mb-3">
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: '#3A3A3C', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                    First Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="first_name"
                    placeholder="John"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    style={{ borderRadius: '10px', padding: '0.875rem', border: '2px solid #EBEBF0' }}
                  />
                </Form.Group>
              </Col>

              <Col md={6} className="mb-3">
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: '#3A3A3C', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                    Last Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="last_name"
                    placeholder="Doe"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    style={{ borderRadius: '10px', padding: '0.875rem', border: '2px solid #EBEBF0' }}
                  />
                </Form.Group>
              </Col>

              <Col md={12} className="mb-3">
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: '#3A3A3C', textTransform: 'uppercase', fontSize: '0.85rem' }}>Phone</Form.Label>
                  <Form.Control
                    type="tel"
                    name="phone"
                    placeholder="+91 XXXXX XXXXX"
                    value={formData.phone}
                    onChange={handleInputChange}
                    style={{ borderRadius: '10px', padding: '0.875rem', border: '2px solid #EBEBF0' }}
                  />
                </Form.Group>
              </Col>

              <Col md={12} className="mb-3">
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: '#3A3A3C', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                    Joining Date <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="joining_date"
                    value={formData.joining_date}
                    onChange={handleInputChange}
                    required
                    style={{ borderRadius: '10px', padding: '0.875rem', border: '2px solid #EBEBF0' }}
                  />
                </Form.Group>
              </Col>

              <Col md={12} className="mb-3">
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: '#3A3A3C', textTransform: 'uppercase', fontSize: '0.85rem' }}>Department</Form.Label>
                  <Form.Control
                    type="text"
                    name="department"
                    placeholder="e.g., Engineering"
                    value={formData.department}
                    onChange={handleInputChange}
                    style={{ borderRadius: '10px', padding: '0.875rem', border: '2px solid #EBEBF0' }}
                  />
                </Form.Group>
              </Col>

              <Col md={12} className="mb-3">
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: '#3A3A3C', textTransform: 'uppercase', fontSize: '0.85rem' }}>Designation</Form.Label>
                  <Form.Control
                    type="text"
                    name="designation"
                    placeholder="e.g., Senior Developer"
                    value={formData.designation}
                    onChange={handleInputChange}
                    style={{ borderRadius: '10px', padding: '0.875rem', border: '2px solid #EBEBF0' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex gap-2 mt-4">
              <Button
                variant="primary"
                type="submit"
                className="w-100"
                disabled={loading}
                style={{ borderRadius: '10px', padding: '0.875rem', fontWeight: 600 }}
              >
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    {editingId ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    {editingId ? '✓ Update Employee' : '✓ Create Employee'}
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Offcanvas.Body>
      </Offcanvas>
    </Container>
  )
}
