import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../api/apiFetch'
import { useAuth } from '../auth/AuthContext'
import { decodeJwt } from '../auth/jwt'

// El login responde una de dos formas:
//  - sin 2FA: { accessToken, refreshToken }
//  - con 2FA: { requires2fa: true, tempToken }
type LoginResponse =
  | { accessToken: string; refreshToken: string }
  | { requires2fa: true; tempToken: string }

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/perfil'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function finish(accessToken: string, refreshToken: string) {
    login(accessToken, refreshToken) // ambos tokens quedan en memoria
    navigate(from, { replace: true })
  }

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      // 401 = credenciales/código incorrectos, 429 = demasiados intentos
      setError(err instanceof ApiError ? `${err.status}: ${err.message}` : 'Error de red')
    } finally {
      setBusy(false)
    }
  }

  // Paso 1: correo + contraseña
  const handlePassword = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const result = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if ('requires2fa' in result) setTempToken(result.tempToken)
      else finish(result.accessToken, result.refreshToken)
    })
  }

  // Paso 2 (solo con 2FA): tempToken + código TOTP -> accessToken + refreshToken
  const handleCode = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const result = await apiFetch<{ accessToken: string; refreshToken: string }>('/api/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ tempToken, code }),
      })
      finish(result.accessToken, result.refreshToken)
    })
  }

  if (tempToken) {
    return (
      <section className="card">
        <h1>Verificación en dos pasos</h1>
        <p>Tu contraseña es correcta. Ahora escribe el código de tu app autenticadora.</p>
        <form onSubmit={handleCode}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            required
          />
          {error && <p className="alert error">{error}</p>}
          <div className="actions">
            <button disabled={busy}>Verificar</button>
            <button type="button" className="secondary" onClick={() => setTempToken(null)}>
              Cancelar
            </button>
          </div>
        </form>
        <details>
          <summary className="muted">Ver payload del tempToken (fíjate en "purpose")</summary>
          <pre>{JSON.stringify(decodeJwt(tempToken)?.payload, null, 2)}</pre>
        </details>
      </section>
    )
  }

  return (
    <section className="card">
      <h1>Iniciar sesión</h1>
      <form onSubmit={handlePassword}>
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="alert error">{error}</p>}
        <button disabled={busy}>Entrar</button>
      </form>
    </section>
  )
}
