import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * Si no hay sesión, redirige a /login.
 * OJO: esto es solo experiencia de usuario. La seguridad real está en la API
 * (RequireAuthorization): ocultar una ruta en React no protege ningún dato.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
