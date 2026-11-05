import { useEffect, useState } from 'react'
import { API_URL, apiFetch } from '../api/apiFetch'
import { useAuth } from '../auth/AuthContext'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const [health, setHealth] = useState('consultando…')

  // Endpoint anónimo: sirve para comprobar que la API y CORS funcionan.
  useEffect(() => {
    apiFetch<{ status: string }>('/api/health')
      .then((r) => setHealth(r.status))
      .catch(() => setHealth('sin conexión (¿la API está corriendo?)'))
  }, [])

  return (
    <section className="card">
      <h1>Autenticación local con JWT</h1>
      <p>
        API: <code>{API_URL}</code> · estado: <strong>{health}</strong>
      </p>
      <p>Sesión: {isAuthenticated ? '✅ iniciada (token en memoria)' : '❌ sin iniciar'}</p>
    </section>
  )
}
