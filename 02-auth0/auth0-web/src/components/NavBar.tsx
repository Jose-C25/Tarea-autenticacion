import { useAuth0 } from '@auth0/auth0-react'

export default function NavBar() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0()

  return (
    <header className="navbar">
      <strong>🔐 Demo Auth · Auth0</strong>
      <nav>
        {isLoading ? null : isAuthenticated ? (
          // returnTo debe estar en "Allowed Logout URLs" de la Application en Auth0.
          // Cierra la sesión local Y la sesión de Auth0 (si no, el próximo login entraría sin pedir nada).
          <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
            Cerrar sesión
          </button>
        ) : (
          // Redirige a la página de login de Auth0 (Universal Login).
          <button onClick={() => loginWithRedirect()}>Iniciar sesión</button>
        )}
      </nav>
    </header>
  )
}
