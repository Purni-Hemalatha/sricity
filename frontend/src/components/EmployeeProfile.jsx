import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import {
  apiGetTeam38Profile,
  apiSaveBankInfo,
  apiAddCTCInfo,
  apiSaveRegInfo,
  apiExitEmployeeTeam38,
  apiSaveCompliance,
  apiUploadDocument,
} from '../api/employeeApi.js'
import oipImage from '../assets/OIP.webp'
import '../styles/EmployeeProfile.css'

/* ─────────────────────────────────────────────────────────────────────────────
   EmployeeProfile — reads from team38 database tables:
     emp_master            → Section 1: Employee Details
     emp_bank_info         → Section 2: Bank Information
     emp_ctc_info          → Section 3: CTC Timeline
     emp_reg_info          → Section 4: Registration IDs
───────────────────────────────────────────────────────────────────────────── */
function EmployeeProfile() {
  const { id: empId } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // form show/hide
  const [showBank, setShowBank] = useState(false)
  const [showCTC, setShowCTC] = useState(false)
  const [showReg, setShowReg] = useState(false)
  const [showMaster, setShowMaster] = useState(false)
  const [showExit, setShowExit] = useState(false)
  const [showComp, setShowComp] = useState(false)
  const [exitDate, setExitDate] = useState('')

  /* ── emp_bank_info form (exact column names) ── */
  const blankBank = { bank_acct_no: '', ifsc_code: '', branch_name: '', bank_name: '' }
  const [bankForm, setBankForm] = useState(blankBank)

  /* ── emp_ctc_info form (exact column names) ── */
  const blankCTC = {
    int_title: '', ext_title: '',
    main_level: '', sub_level: '',
    start_of_ctc: '', end_of_ctc: '', ctc_amt: '',
  }
  const [ctcForm, setCTCForm] = useState(blankCTC)

  /* ── emp_reg_info form (exact column names) ── */
  const blankReg = { pan: '', aadhaar: '', uan_epf_acctno: '', esi: '' }
  const [regForm, setRegForm] = useState(blankReg)

  /* ── emp_master form ── */
  const blankMaster = { first_name: '', middle_name: '', last_name: '', start_date: '', end_date: '' }
  const [masterForm, setMasterForm] = useState(blankMaster)

  /* ── emp_compliance_tracker form ── */
  const blankComp = { comp_type: '', status: 'PENDING', doc_url: '' }
  const [compForm, setCompForm] = useState(blankComp)
  const [isUploading, setIsUploading] = useState(false)

  /* ── Onboarding Checklist form ── */
  const blankChecklistItem = { item_name: '', is_completed: false, document_url: '', notes: '' }
  const [checklistItemForm, setChecklistItemForm] = useState(blankChecklistItem)
  const checklistItems = [
    'PAN_CARD', 'AADHAAR_CARD', 'UAN_EPF', 'ESI', 'BANK_DETAILS',
    'PASSPORT', 'DRIVING_LICENSE', 'FORM_COMPLETED', 'DOCUMENTS_VERIFIED'
  ]

  /* ── Load ── */
  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await apiGetTeam38Profile({ token, empId })
      setData(res)
      // pre-fill edit forms with existing data
      if (res.emp_bank_info)
        setBankForm({
          bank_acct_no: res.emp_bank_info.bank_acct_no || '',
          ifsc_code: res.emp_bank_info.ifsc_code || '',
          branch_name: res.emp_bank_info.branch_name || '',
          bank_name: res.emp_bank_info.bank_name || ''
        })
      if (res.emp_reg_info)
        setRegForm({
          pan: res.emp_reg_info.pan || '',
          aadhaar: res.emp_reg_info.aadhaar || '',
          uan_epf_acctno: res.emp_reg_info.uan_epf_acctno || '',
          esi: res.emp_reg_info.esi || ''
        })
      if (res.emp_master)
        setMasterForm({
          first_name: res.emp_master.first_name || '',
          middle_name: res.emp_master.middle_name || '',
          last_name: res.emp_master.last_name || '',
          start_date: res.emp_master.start_date || '',
          end_date: res.emp_master.end_date || ''
        })
    } catch (e) { setError(e.message || 'Failed to load profile') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [empId, token])

  const toast = (msg, ok = true) => { ok ? setSuccess(msg) : setError(msg) }

  /* ── Bank submit ── */
  async function handleBank(e) {
    e.preventDefault(); setError(null)
    try {
      await apiSaveBankInfo({ token, empId, ...bankForm })
      toast('Bank details saved!'); setShowBank(false); load()
    } catch (err) { toast(err.message || 'Save failed', false) }
  }

  /* ── CTC submit ── */
  async function handleCTC(e) {
    e.preventDefault(); setError(null)
    try {
      await apiAddCTCInfo({ token, empId, ...ctcForm })
      toast('CTC record added!'); setShowCTC(false); setCTCForm(blankCTC); load()
    } catch (err) { toast(err.message || 'Save failed', false) }
  }

  /* ── Reg Info submit ── */
  async function handleReg(e) {
    e.preventDefault(); setError(null)
    try {
      await apiSaveRegInfo({ token, empId, ...regForm })
      toast('Registration IDs saved!'); setShowReg(false); load()
    } catch (err) { toast(err.message || 'Save failed', false) }
  }

  /* ── Master Info submit ── */
  async function handleMaster(e) {
    e.preventDefault(); setError(null)
    try {
      const resp = await fetch(`http://localhost:8000/api/team38/emp-master/${empId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(masterForm)
      })
      if (!resp.ok) throw new Error('Failed to update employee details')
      toast('Employee details updated!')
      setShowMaster(false)
      load()
    } catch (err) { toast(err.message || 'Save failed', false) }
  }

  /* ── Exit Employee submit ── */
  async function handleExit(e) {
    e.preventDefault(); setError(null)
    try {
      if (!exitDate) {
        toast('Please enter exit date', false)
        return
      }
      await apiExitEmployeeTeam38({ token, empId, exit_date: exitDate })
      toast('Employee marked as exited!'); setShowExit(false); setExitDate(''); load()
    } catch (err) { toast(err.message || 'Exit failed', false) }
  }

  /* ── Compliance submit ── */
  async function handleSaveCompliance(e) {
    if (e) e.preventDefault(); setError(null)
    try {
      await apiSaveCompliance({ token, empId, ...compForm })
      toast('Compliance document saved!')
      setShowComp(false)
      setCompForm(blankComp)
      load()
    } catch (err) { toast(err.message || 'Save failed', false) }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    if (!compForm.comp_type) {
      toast('Please select a Document Type first!', false)
      return
    }

    setIsUploading(true)
    setError(null)
    try {
      const { url } = await apiUploadDocument({ token, file })
      const fullUrl = `http://localhost:8000${url}`

      // Update form state
      setCompForm(prev => ({ ...prev, doc_url: fullUrl }))

      // Auto-save to database
      await apiSaveCompliance({
        token,
        empId,
        comp_type: compForm.comp_type,
        status: compForm.status,
        doc_url: fullUrl
      })

      toast('File uploaded and saved to database!')
      setShowComp(false)
      setCompForm(blankComp)
      load()
    } catch (err) {
      toast(err.message || 'Upload failed', false)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleVerify(item) {
    try {
      await apiSaveCompliance({
        token,
        empId,
        comp_type: item.comp_type,
        status: 'VERIFIED',
        doc_url: item.doc_url
      })
      toast('Document verified!')
      load()
    } catch (err) { toast(err.message || 'Verification failed', false) }
  }

  /* ── Render helpers ── */
  if (loading) return (
    <div className="profile-container">
      <div className="text-center py-5">
        <div className="spinner-border" role="status"><span className="visually-hidden">Loading…</span></div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="profile-container">
      <div className="alert alert-danger">{error || 'Employee not found'}</div>
    </div>
  )

  /* ── Destructure from team38 tables ── */
  const m = data.emp_master || {}
  const b = data.emp_bank_info || null
  const ctc = data.emp_ctc_info || []
  const r = data.emp_reg_info || null
  const compliance = data.emp_compliance_tracker || []

  const fullName = [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ')

  const formatLakh = (amt) => {
    if (!amt) return '₹0'
    const val = Number(amt)
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
    return `₹${val.toLocaleString('en-IN')}`
  }

  const ctcSorted = [...ctc].sort((a, b) => new Date(b.start_of_ctc) - new Date(a.start_of_ctc))
  const currentRole = ctcSorted[0] || {}
  const firstRole = ctcSorted[ctcSorted.length - 1] || {}
  const growth = currentRole.ctc_amt && firstRole.ctc_amt
    ? ((currentRole.ctc_amt - firstRole.ctc_amt) / firstRole.ctc_amt * 100).toFixed(1)
    : 0

  return (
    <div className="profile-container">

      {/* ── Header ── */}
      <div className="profile-header d-flex justify-content-between align-items-center">
        <button className="btn btn-outline-secondary" onClick={() => navigate('/directory')}>
          ← Back to List
        </button>
        <h2>Employee Profile</h2>
        <div className="d-flex gap-2">
          {m.end_date ? (
            <span className="badge bg-secondary" style={{ alignSelf: 'center' }}>EXITED</span>
          ) : (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setShowExit(true)}
            >
              <i className="bi bi-door-closed" /> Exit Employee
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger  alert-dismissible fade show">{error}  <button type="button" className="btn-close" onClick={() => setError(null)} /></div>}
      {success && <div className="alert alert-success alert-dismissible fade show">{success}<button type="button" className="btn-close" onClick={() => setSuccess(null)} /></div>}

      {/* ── Profile Overview ── */}
      {data && (
        <div className="card mb-4 border-0 shadow-sm" style={{ borderRadius: '15px', overflow: 'hidden' }}>
          <div className="card-body p-4">
            <div className="row align-items-center g-4">
              {/* Circular Profile Image */}
              <div className="col-md-auto">
                <div style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  border: '4px solid #007bff'
                }}>
                  <img
                    src={oipImage}
                    alt={fullName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
              </div>

              {/* Combined Employee Info */}
              <div className="col-md">
                <div className="row g-4">
                  <div className="col-sm-6">
                    <div className="fs-5 fw-bold text-dark">{fullName}</div>
                    <div className="text-muted small">ID: {m.emp_id}</div>
                  </div>
                  <div className="col-sm-6">
                    <div className="fs-5 fw-bold text-dark text-uppercase mb-0">
                      {ctcSorted[0]?.ext_title || 'No Designation'}
                    </div>
                    <div className="text-muted small">
                      {ctcSorted[0]?.int_title || 'Designation'}
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="fs-5 fw-bold text-success">
                      {ctcSorted[0]?.ctc_amt ? `₹${Number(ctcSorted[0].ctc_amt).toLocaleString('en-IN')}` : '₹0'}
                    </div>
                    <div className="text-muted small">Annual CTC</div>
                  </div>
                  <div className="col-sm-6">
                    <div className="fs-5 fw-bold text-dark">{m.start_date || 'N/A'}</div>
                    <div className="text-muted small">Joining Date</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          1. emp_master
          Columns: emp_id, first_name, middle_name, last_name,
                   start_date, end_date
      ══════════════════════════════════════════════════════ */}
      <div className="card mb-4">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5><i className="bi bi-person-badge" /> Employee Details</h5>
          {!showMaster && (
            <button className="btn btn-light btn-sm" onClick={() => setShowMaster(true)}>
              <i className="bi bi-pencil" /> Edit
            </button>
          )}
        </div>
        <div className="card-body">
          {showMaster ? (
            <form onSubmit={handleMaster}>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">First Name *</label>
                  <input type="text" className="form-control" required
                    value={masterForm.first_name}
                    onChange={e => setMasterForm({ ...masterForm, first_name: e.target.value })} />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Middle Name</label>
                  <input type="text" className="form-control"
                    value={masterForm.middle_name}
                    onChange={e => setMasterForm({ ...masterForm, middle_name: e.target.value })} />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Last Name *</label>
                  <input type="text" className="form-control" required
                    value={masterForm.last_name}
                    onChange={e => setMasterForm({ ...masterForm, last_name: e.target.value })} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Start Date *</label>
                  <input type="date" className="form-control" required
                    value={masterForm.start_date}
                    onChange={e => setMasterForm({ ...masterForm, start_date: e.target.value })} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">End Date</label>
                  <input type="date" className="form-control"
                    value={masterForm.end_date}
                    onChange={e => setMasterForm({ ...masterForm, end_date: e.target.value })} />
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">Save Changes</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMaster(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="row">
              <div className="col-md-6 mb-3"><strong>Employee ID:</strong> {m.emp_id}</div>
              <div className="col-md-6 mb-3"><strong>Full Name:</strong> {fullName || '—'}</div>
              <div className="col-md-6 mb-3"><strong>First Name:</strong> {m.first_name || '—'}</div>
              <div className="col-md-6 mb-3"><strong>Middle Name:</strong> {m.middle_name || '—'}</div>
              <div className="col-md-6 mb-3"><strong>Last Name:</strong> {m.last_name || '—'}</div>
              <div className="col-md-6 mb-3"><strong>Start Date:</strong> {m.start_date || '—'}</div>
              <div className="col-md-6 mb-3"><strong>End Date:</strong> {m.end_date || '—'}</div>
              <div className="col-md-6 mb-3">
                <strong>Status:</strong>{' '}
                <span className={`badge ${m.end_date ? 'bg-secondary' : 'bg-success'}`}>
                  {m.end_date ? 'EXITED' : 'ACTIVE'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          2. emp_bank_info
          Columns: emp_id, bank_acct_no, ifsc_code, branch_name, bank_name
      ══════════════════════════════════════════════════════ */}
      <div className="card mb-4">
        <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
          <h5><i className="bi bi-bank" /> Bank Information</h5>
          <div className="d-flex align-items-center gap-2">
            {!showBank && (
              <button className="btn btn-light btn-sm" onClick={() => setShowBank(true)}>
                <i className="bi bi-pencil" /> {b ? 'Edit' : 'Add'}
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {showBank ? (
            <form onSubmit={handleBank}>
              <div className="row">
                {/* bank_acct_no */}
                <div className="col-md-6 mb-3">
                  <label className="form-label">Account Number *</label>
                  <input type="text" className="form-control" required maxLength="20"
                    value={bankForm.bank_acct_no}
                    onChange={e => setBankForm({ ...bankForm, bank_acct_no: e.target.value })}
                    placeholder="Account number" />
                </div>
                {/* ifsc_code */}
                <div className="col-md-6 mb-3">
                  <label className="form-label">IFSC Code *</label>
                  <input type="text" className="form-control" required maxLength="11"
                    value={bankForm.ifsc_code}
                    onChange={e => setBankForm({ ...bankForm, ifsc_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0001234" />
                </div>
                {/* branch_name */}
                <div className="col-md-6 mb-3">
                  <label className="form-label">Branch Name</label>
                  <input type="text" className="form-control" maxLength="100"
                    value={bankForm.branch_name}
                    onChange={e => setBankForm({ ...bankForm, branch_name: e.target.value })} />
                </div>
                {/* bank_name */}
                <div className="col-md-6 mb-3">
                  <label className="form-label">Bank Name *</label>
                  <input type="text" className="form-control" required maxLength="100"
                    value={bankForm.bank_name}
                    onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })} />
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBank(false)}>Cancel</button>
              </div>
            </form>
          ) : b ? (
            <div className="row">
              <div className="col-md-6 mb-3"><strong>Account Number:</strong>  {b.bank_acct_no}</div>
              <div className="col-md-6 mb-3"><strong>IFSC Code:</strong>     {b.ifsc_code}</div>
              <div className="col-md-6 mb-3"><strong>Branch Name:</strong>   {b.branch_name || '—'}</div>
              <div className="col-md-6 mb-3"><strong>Bank Name:</strong>     {b.bank_name}</div>
            </div>
          ) : (
            <p className="text-muted">No bank record found. Click Add to create one.</p>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          3. emp_ctc_info
          Columns: int_title, ext_title, main_level, sub_level,
                   start_of_ctc, end_of_ctc, ctc_amt
      ══════════════════════════════════════════════════════ */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-success text-white d-flex justify-content-between align-items-center py-3">
          <h5 className="mb-0 fw-bold"><i className="bi bi-currency-dollar" /> CTC History & Role Changes</h5>
        </div>
        <div className="card-body bg-light-subtle p-4">

          {/* Summary Cards */}
          <div className="ctc-summary-grid">
            <div className="ctc-summary-card">
              <div className="ctc-summary-label">Current Role</div>
              <div className="ctc-summary-value">{currentRole.ext_title || '—'}</div>
              <div className="grade-badge">{currentRole.main_level ? `L${currentRole.main_level}-${currentRole.sub_level}` : '—'}</div>
            </div>
            <div className="ctc-summary-card">
              <div className="ctc-summary-label">Current CTC</div>
              <div className="ctc-summary-value text-success">{formatLakh(currentRole.ctc_amt)}</div>
              <div className="ctc-summary-sub">₹{Number(currentRole.ctc_amt || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="ctc-summary-card">
              <div className="ctc-summary-label">Total Growth</div>
              <div className="ctc-summary-value text-primary">
                <i className={`bi bi-graph-up-arrow`} /> {growth}%
              </div>
              <div className="ctc-summary-sub">
                {formatLakh(firstRole.ctc_amt)} → {formatLakh(currentRole.ctc_amt)}
              </div>
            </div>
            <div className="ctc-summary-card">
              <div className="ctc-summary-label">Role Changes</div>
              <div className="ctc-summary-value">{ctc.length}</div>
              <div className="ctc-summary-sub">{ctc.length} total records</div>
            </div>
          </div>

          {!showCTC && (
            <div className="text-center mb-5">
              <button className="btn btn-success btn-lg px-5 fw-bold shadow-sm" onClick={() => setShowCTC(true)}>
                <i className="bi bi-plus-circle" /> Add Role Change
              </button>
            </div>
          )}
          {showCTC && (
            <div className="ctc-form-box shadow-sm mb-5">
              <h6 className="fw-bold mb-4 d-flex align-items-center">
                <i className="bi bi-plus-circle-fill text-success fs-5 me-2" /> Add New CTC/Role Change
              </h6>

              <div className="ctc-info-banner border-0 mb-4 shadow-none">
                <i className="bi bi-info-circle-fill me-2" />
                <strong>Current Role:</strong> {currentRole.ext_title} | <strong>Level:</strong> {currentRole.main_level}-{currentRole.sub_level} | <strong>CTC:</strong> ₹{Number(currentRole.ctc_amt).toLocaleString('en-IN')} | <strong>Since:</strong> {currentRole.start_of_ctc}
                <div className="mt-1 small opacity-75">
                  <i className="bi bi-info-circle ms-1" /> The current record will be auto-closed when you save the new record.
                </div>
              </div>

              <form onSubmit={handleCTC}>
                <div className="row g-4">
                  <div className="col-md-6 mb-2">
                    <label className="ctc-form-label">Internal Title *</label>
                    <input type="text" className="form-control form-control-lg" required maxLength="30"
                      value={ctcForm.int_title}
                      onChange={e => setCTCForm({ ...ctcForm, int_title: e.target.value })}
                      placeholder="e.g., ENG-L3A, SM-L4B" />
                    <div className="ctc-form-hint">Company internal designation code</div>
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="ctc-form-label">External Title *</label>
                    <input type="text" className="form-control form-control-lg" required maxLength="60"
                      value={ctcForm.ext_title}
                      onChange={e => setCTCForm({ ...ctcForm, ext_title: e.target.value })}
                      placeholder="e.g., Senior Software Engineer" />
                    <div className="ctc-form-hint">Public-facing job title</div>
                  </div>

                  <div className="col-md-3">
                    <label className="ctc-form-label">Main Level *</label>
                    <select className="form-select form-select-lg" required
                      value={ctcForm.main_level}
                      onChange={e => setCTCForm({ ...ctcForm, main_level: e.target.value })}>
                      <option value="">Select Level</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>Level {n}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="ctc-form-label">Sub Level *</label>
                    <select className="form-select form-select-lg" required
                      value={ctcForm.sub_level}
                      onChange={e => setCTCForm({ ...ctcForm, sub_level: e.target.value })}>
                      <option value="">Select</option>
                      {['A', 'B', 'C', 'D', 'E'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="ctc-form-label">Effective From *</label>
                    <input type="date" className="form-control form-control-lg" required
                      value={ctcForm.start_of_ctc}
                      onChange={e => setCTCForm({ ...ctcForm, start_of_ctc: e.target.value })} />
                    <div className="ctc-form-hint">Role change effective date</div>
                  </div>
                  <div className="col-md-3">
                    <label className="ctc-form-label">New CTC Amount *</label>
                    <input type="number" className="form-control form-control-lg" required min="0"
                      value={ctcForm.ctc_amt}
                      onChange={e => setCTCForm({ ...ctcForm, ctc_amt: e.target.value })}
                      placeholder="500000" />
                    <div className="ctc-form-hint">Annual CTC in ₹</div>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-4 pt-2">
                  <button type="submit" className="btn btn-success btn-lg px-4 d-flex align-items-center gap-2">
                    <i className="bi bi-save" /> Save Role Change
                  </button>
                  <button type="button" className="btn btn-secondary btn-lg px-4" onClick={() => { setShowCTC(false); setCTCForm(blankCTC) }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Career Timeline */}
          <div className="mb-5">
            <h6 className="fw-bold mb-4 text-dark opacity-75 d-flex align-items-center">
              <i className="bi bi-alarm me-2" /> Career Timeline
            </h6>
            <div className="alt-timeline p-3 border rounded-3 bg-white">
              {ctcSorted.map((c, idx) => (
                <div key={idx} className="alt-timeline-item">
                  <div className="alt-timeline-date text-muted">
                    {c.start_of_ctc}<br />
                    <span style={{ fontSize: '0.75rem' }}>to {c.end_of_ctc || (idx === 0 ? 'Present' : '—')}</span>
                  </div>
                  <div className="alt-timeline-line">
                    <div className={`alt-timeline-dot ${idx === 0 && !c.end_of_ctc ? 'current' : ''}`} />
                  </div>
                  <div className="alt-timeline-info ps-3">
                    <h6 className="text-uppercase">{c.ext_title}</h6>
                    <p>{c.int_title} | Level {c.main_level}-{c.sub_level}</p>
                    {idx === 0 && !c.end_of_ctc && <span className="badge bg-success mt-1 small" style={{ fontSize: '0.65rem' }}>CURRENT</span>}
                  </div>
                  <div className="alt-timeline-amt">
                    {formatLakh(c.ctc_amt)}
                    {/* Simplified duration display */}
                    <div className="alt-timeline-subamt">{idx === 0 ? 'Starts today' : 'Ended'}</div>
                  </div>
                </div>
              ))}
              {ctcSorted.length === 0 && <div className="text-center py-4 text-muted">No timeline entries found.</div>}
            </div>
          </div>

          {/* Detailed History Table */}
          <div>
            <h6 className="fw-bold mb-4 text-dark opacity-75 d-flex align-items-center">
              <i className="bi bi-table me-2" /> Detailed History
            </h6>
            <div className="table-responsive border rounded-3 bg-white shadow-sm">
              <table className="table ctc-table table-hover mb-0">
                <thead>
                  <tr>
                    <th className="ps-4">#</th>
                    <th>Period</th>
                    <th>Title</th>
                    <th>Level</th>
                    <th>CTC</th>
                    <th>Duration</th>
                    <th className="text-center pe-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ctcSorted.map((c, idx) => (
                    <tr key={idx}>
                      <td className="ps-4 text-muted">{ctcSorted.length - idx}</td>
                      <td>
                        <div className="fw-bold">{c.start_of_ctc}</div>
                        <div className="small text-muted">→ {c.end_of_ctc || 'Present'}</div>
                      </td>
                      <td>
                        <div className="fw-bold">{c.ext_title}</div>
                        <div className="small text-muted">{c.int_title}</div>
                      </td>
                      <td>
                        <div className="grade-badge bg-primary opacity-75">L{c.main_level}-{c.sub_level}</div>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">₹{Number(c.ctc_amt).toLocaleString('en-IN')}</div>
                        <div className="small text-muted opacity-75">{formatLakh(c.ctc_amt)} per annum</div>
                      </td>
                      <td>
                        <div className="small">Active role</div>
                      </td>
                      <td className="text-center pe-4">
                        {idx === 0 && !c.end_of_ctc ? (
                          <span className="badge bg-success-subtle text-success border border-success px-3"><i className="bi bi-check-circle-fill me-1" /> ACTIVE</span>
                        ) : (
                          <span className="badge-ended text-uppercase">ENDED</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>



      {/* ══════════════════════════════════════════════════════
          5. emp_reg_info
          Columns: pan, aadhaar, uan_epf_acctno, esi
      ══════════════════════════════════════════════════════ */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ background: '#7c3aed', color: '#fff' }}>
          <h5><i className="bi bi-card-text" /> Registration IDs</h5>
          <div className="d-flex align-items-center gap-2">
            {!showReg && (
              <button className="btn btn-light btn-sm" onClick={() => setShowReg(true)}>
                <i className="bi bi-pencil" /> {r ? 'Edit' : 'Add'}
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {showReg ? (
            <form onSubmit={handleReg}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">PAN Card * (10 chars)</label>
                  <input type="text" className="form-control" required maxLength="10"
                    value={regForm.pan}
                    onChange={e => setRegForm({ ...regForm, pan: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F" />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Aadhaar Number * (12 digits)</label>
                  <input type="text" className="form-control" required maxLength="12" pattern="\d{12}"
                    value={regForm.aadhaar}
                    onChange={e => setRegForm({ ...regForm, aadhaar: e.target.value })}
                    placeholder="123412341234" />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">UAN (EPF) Account</label>
                  <input type="text" className="form-control" maxLength="20"
                    value={regForm.uan_epf_acctno}
                    onChange={e => setRegForm({ ...regForm, uan_epf_acctno: e.target.value })} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">ESI Number</label>
                  <input type="text" className="form-control" maxLength="25"
                    value={regForm.esi}
                    onChange={e => setRegForm({ ...regForm, esi: e.target.value })} />
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReg(false)}>Cancel</button>
              </div>
            </form>
          ) : r ? (
            <div className="row">
              <div className="col-md-6 mb-3"><strong>PAN Card:</strong>             {r.pan}</div>
              <div className="col-md-6 mb-3"><strong>Aadhaar Number:</strong>         {r.aadhaar}</div>
              <div className="col-md-6 mb-3"><strong>UAN (EPF) Account:</strong>  {r.uan_epf_acctno || '—'}</div>
              <div className="col-md-6 mb-3"><strong>ESI Number:</strong>             {r.esi || '—'}</div>
            </div>
          ) : (
            <p className="text-muted">No registration IDs on record. Click Add to create.</p>
          )}
        </div>
      </div>


      {/* 6. Compliance Documents */}
      <div className="card mb-4 border-0 shadow-sm" style={{ borderRadius: '15px' }}>
        <div className="card-header d-flex justify-content-between align-items-center py-3" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderTopLeftRadius: '15px', borderTopRightRadius: '15px', color: 'white' }}>
          <h5 className="mb-0 fw-bold"><i className="bi bi-shield-check" /> Compliance Documents</h5>
          {!showComp && (
            <button className="btn btn-light btn-sm fw-bold px-3 rounded-pill" onClick={() => setShowComp(true)}>
              <i className="bi bi-plus-lg" /> Add Document
            </button>
          )}
        </div>
        <div className="card-body p-4">
          {showComp && (
            <div className="p-4 mb-4 border rounded-3 bg-light shadow-sm">
              <h6 className="fw-bold mb-3">Add / Update Document</h6>
              <form onSubmit={handleSaveCompliance}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted text-uppercase">Document Type *</label>
                    <select className="form-select" required
                      value={compForm.comp_type}
                      onChange={e => setCompForm({ ...compForm, comp_type: e.target.value })}>
                      <option value="">Select Type</option>
                      <option value="PAN_CARD">PAN Card</option>
                      <option value="AADHAAR_CARD">Aadhaar Card</option>
                      <option value="VOTER_ID">Voter ID</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="DRIVING_LICENSE">Driving License</option>
                      <option value="GRADUATION_DEGREE">Graduation Degree</option>
                      <option value="EXPERIENCE_LETTER">Experience Letter</option>
                      <option value="RELIEVING_LETTER">Relieving Letter</option>
                    </select>
                  </div>
                  <div className="col-md-5">
                    <label className="form-label small fw-bold text-muted text-uppercase">Document URL *</label>
                    <div className="input-group">
                      <input type="url" className="form-control" required
                        value={compForm.doc_url}
                        onChange={e => setCompForm({ ...compForm, doc_url: e.target.value })}
                        placeholder="https://example.com/doc.pdf" />
                      <label className="btn btn-outline-secondary mb-0" style={{ cursor: 'pointer' }}>
                        {isUploading ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-upload" />}
                        <input type="file" hidden onChange={handleFileUpload} disabled={isUploading} />
                      </label>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-bold text-muted text-uppercase">Status</label>
                    <select className="form-select"
                      value={compForm.status}
                      onChange={e => setCompForm({ ...compForm, status: e.target.value })}>
                      <option value="PENDING">PENDING</option>
                      <option value="VERIFIED">VERIFIED</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                  <button type="submit" className="btn btn-warning fw-bold text-white px-4">Save Document</button>
                  <button type="button" className="btn btn-outline-secondary px-4" onClick={() => { setShowComp(false); setCompForm(blankComp) }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {compliance.length > 0 ? (
            <div className="table-responsive border rounded-3 overflow-hidden bg-white">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-light">
                  <tr>
                    <th className="ps-4 small text-uppercase fw-bold text-muted">Type</th>
                    <th className="small text-uppercase fw-bold text-muted">Status</th>
                    <th className="small text-uppercase fw-bold text-muted">Document</th>
                    <th className="text-end pe-4 small text-uppercase fw-bold text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.map((item, idx) => (
                    <tr key={idx}>
                      <td className="ps-4 fw-bold text-dark">{item.comp_type.replace(/_/g, ' ')}</td>
                      <td>
                        <span className={`badge rounded-pill px-3 py-2 ${item.status === 'VERIFIED' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`} style={{ border: item.status === 'VERIFIED' ? '1px solid #198754' : '1px solid #ffc107', fontSize: '11px' }}>
                          <i className={`bi ${item.status === 'VERIFIED' ? 'bi-check-circle-fill' : 'bi-clock-fill'} me-1`} />
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <a href={item.doc_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary rounded-pill px-3">
                          <i className="bi bi-link-45deg" /> View Link
                        </a>
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-2">
                          {item.status === 'PENDING' && (
                            <button className="btn btn-sm btn-success rounded-pill px-3 fw-bold" onClick={() => handleVerify(item)}>
                              <i className="bi bi-check2" /> Verify
                            </button>
                          )}
                          <button className="btn btn-sm btn-outline-secondary rounded-pill" title="Edit" onClick={() => {
                            setCompForm({
                              comp_type: item.comp_type,
                              status: item.status,
                              doc_url: item.doc_url
                            })
                            setShowComp(true)
                          }}>
                            <i className="bi bi-pencil" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5 border rounded-3 bg-light-subtle">
              <i className="bi bi-file-earmark-text text-muted opacity-25" style={{ fontSize: '3rem' }} />
              <p className="mt-2 text-muted fw-bold">No compliance documents uploaded yet.</p>
              <button className="btn btn-sm btn-warning text-white mt-1 fw-bold" onClick={() => setShowComp(true)}>Upload Now</button>
            </div>
          )}
        </div>
      </div>

      {showExit && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title"><i className="bi bi-exclamation-triangle" /> Exit Employee</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowExit(false)}></button>
              </div>
              <form onSubmit={handleExit}>
                <div className="modal-body">
                  <p className="mb-3">
                    <strong>Employee:</strong> {fullName} ({m.emp_id})
                  </p>
                  <div className="alert alert-warning" role="alert">
                    <i className="bi bi-exclamation-circle" /> This will mark the employee as exited and update their status in the system.
                  </div>
                  <div className="mb-3">
                    <label className="form-label"><strong>Last Working Day *</strong></label>
                    <input
                      type="date"
                      className="form-control"
                      required
                      value={exitDate}
                      onChange={e => setExitDate(e.target.value)}
                    />
                    <small className="text-muted">The employee's final day of work</small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowExit(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger">
                    <i className="bi bi-door-closed" /> Mark as Exited
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default EmployeeProfile