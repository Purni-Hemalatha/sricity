import { Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from './pages/auth.jsx'
import HomePage from './pages/home.jsx'
import EmployeeManager from './components/EmployeeManager.jsx'
import EmployeeDirectory from './components/EmployeeDirectory.jsx'
import EmployeeProfile from './components/EmployeeProfile.jsx'
import ComplianceDashboard from './components/ComplianceDashboard.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import Layout from './components/Layout.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth" replace />} />
      <Route path="/auth" element={<AuthPage />} />

      {/* Internal Management Routes - Shared Layout */}
      <Route path="/home" element={<Layout><HomePage /></Layout>} />
      <Route path="/employees" element={<Layout><EmployeeManager /></Layout>} />
      <Route path="/directory" element={<Layout><EmployeeDirectory /></Layout>} />
      <Route path="/employees/:id/profile" element={<Layout><EmployeeProfile /></Layout>} />
      <Route path="/compliance" element={<Layout><ComplianceDashboard /></Layout>} />

      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>)
}

export default App