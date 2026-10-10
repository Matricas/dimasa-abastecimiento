import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import DiagnosticPage from './pages/DiagnosticPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/diagnostico" element={<DiagnosticPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/diagnostico" replace />} />
    </Routes>
  )
}

export default App
