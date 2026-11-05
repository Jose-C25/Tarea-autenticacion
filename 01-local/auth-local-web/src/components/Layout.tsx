import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Layout() {
  const { isAuthenticated, logout } = useAuth()

  return (
    <>
      <header className="navbar">
        <strong>🔐 Demo Auth · Local</strong>
        <nav>
          <NavLink to="/" end>
            Inicio
          </NavLink>
          {isAuthenticated ? (
            <>
              <NavLink to="/perfil">Perfil</NavLink>
              <NavLink to="/seguridad">Seguridad</NavLink>
              <button onClick={logout}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <NavLink to="/registro">Registro</NavLink>
              <NavLink to="/login">Iniciar sesión</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
