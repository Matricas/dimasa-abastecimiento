import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import DiagnosticPage from './pages/DiagnosticPage'
import MatrixPage from './pages/MatrixPage'
import ForecastPage from './pages/ForecastPage'
import PurchasePage from './pages/PurchasePage'
import RoleRoute from './components/RoleRoute'
import UsersPage from './pages/UsersPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/diagnostico" element={<DiagnosticPage />} />
          <Route path="/matriz" element={<MatrixPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/compras" element={<PurchasePage />} />
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/usuarios" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/diagnostico" replace />} />
    </Routes>
  )
}

export default App
