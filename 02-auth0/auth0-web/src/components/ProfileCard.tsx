import { useAuth0 } from '@auth0/auth0-react'

/**
 * Datos del usuario tomados del ID TOKEN (scopes openid profile email).
 * El ID Token es para el FRONTEND (quién es el usuario);
 * el Access Token es para la API (qué puede hacer). No se mezclan.
 */
export default function ProfileCard() {
  const { user } = useAuth0()
  if (!user) return null

  return (
    <section className="card profile">
      {user.picture && <img src={user.picture} alt={user.name ?? 'Foto de perfil'} width={72} height={72} />}
      <div>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <p className="muted">
          sub: <code>{user.sub}</code>
          {/* sub con "google-oauth2|..." indica conexión social; "auth0|..." usuario/contraseña */}
        </p>
      </div>
    </section>
  )
}
