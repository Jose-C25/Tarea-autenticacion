import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, ApiError } from '../api/apiFetch'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })
      setDone(true)
    } catch (err) {
      // 400 = validación, 409 = correo ya registrado
      setError(err instanceof ApiError ? `${err.status}: ${err.message}` : 'Error de red')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="card">
        <p className="alert ok">Cuenta creada para {email}.</p>
        <p>
          <Link to="/login">Ir a iniciar sesión →</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="card">
      <h1>Crear cuenta</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña (mínimo 8 caracteres)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="alert error">{error}</p>}
        <button disabled={busy}>Registrarme</button>
      </form>
    </section>
  )
}
