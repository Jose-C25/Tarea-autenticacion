import { useAuth0 } from '@auth0/auth0-react'
import AccessTokenPanel from './components/AccessTokenPanel'
import ApiPanel from './components/ApiPanel'
import MessagesPanel from './components/MessagesPanel'
import NavBar from './components/NavBar'
import ProfileCard from './components/ProfileCard'
import { config } from './config'

export default function App() {
  const { isLoading, isAuthenticated, error } = useAuth0()

  return (
    <>
      <NavBar />
      <main className="container">
        {/* Errores devueltos por Auth0 (ej.: el usuario canceló, callback no permitido, API inexistente) */}
        {error && <p className="alert error">Error de Auth0: {error.message}</p>}

        {isLoading ? (
          // Mientras el SDK procesa el ?code=... del callback o revisa la sesión.
          <section className="card">Cargando sesión…</section>
        ) : isAuthenticated ? (
          <>
            <ProfileCard />
            <MessagesPanel />
            <ApiPanel />
            <AccessTokenPanel />
          </>
        ) : (
          <section className="card">
            <h1>Bienvenido</h1>
            <p>
              Inicia sesión con Auth0 (usuario/contraseña o Google). Tenant: <code>{config.domain}</code>
            </p>
          </section>
        )}
      </main>
    </>
  )
}
