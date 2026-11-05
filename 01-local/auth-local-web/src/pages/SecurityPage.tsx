import { QRCodeSVG } from 'qrcode.react'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/apiFetch'
import { useAuth } from '../auth/AuthContext'

interface SetupResponse {
  secret: string
  otpauthUri: string
}

export default function SecurityPage() {
  const { authFetch } = useAuth()
  const [setup, setSetup] = useState<SetupResponse | null>(null)
  const [code, setCode] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showError = (err: unknown) =>
    setError(err instanceof ApiError ? `${err.status}: ${err.message}` : 'Error de red')

  // Paso 1: la API genera el secreto y nos da la URI otpauth:// para el QR.
  async function startSetup() {
    setError(null)
    try {
      setSetup(await authFetch<SetupResponse>('/api/auth/2fa/setup', { method: 'POST' }))
    } catch (err) {
      showError(err) // 409 si el 2FA ya estaba activo
    }
  }

  // Paso 2: confirmamos con un código de la app; solo entonces se activa el 2FA.
  async function confirm(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await authFetch('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) })
      setEnabled(true)
    } catch (err) {
      showError(err) // 400 si el código es incorrecto
    }
  }

  return (
    <section className="card">
      <h1>Seguridad · Verificación en dos pasos (2FA)</h1>
      <p className="muted">
        Usa Google Authenticator, Microsoft Authenticator o similar. El código cambia cada 30 segundos (TOTP).
      </p>

      {enabled ? (
        <p className="alert ok">
          ✅ 2FA activado. Cierra sesión y vuelve a entrar: ahora te pedirá el código.
        </p>
      ) : !setup ? (
        <button onClick={startSetup}>Activar 2FA</button>
      ) : (
        <>
          <p>1. Escanea este código QR con tu app autenticadora:</p>
          {/* El QR contiene la URI otpauth://totp/DemoAuth:correo?secret=... */}
          <div style={{ background: '#fff', padding: 12, display: 'inline-block', borderRadius: 8 }}>
            <QRCodeSVG value={setup.otpauthUri} size={180} />
          </div>
          <p>
            ¿No puedes escanear? Ingresa este secreto manualmente: <code>{setup.secret}</code>
          </p>
          <details>
            <summary className="muted">Ver URI otpauth</summary>
            <pre>{setup.otpauthUri}</pre>
          </details>

          <p>2. Escribe el código de 6 dígitos que muestra la app:</p>
          <form onSubmit={confirm}>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button>Confirmar y activar</button>
          </form>
        </>
      )}

      {error && <p className="alert error">{error}</p>}
    </section>
  )
}
