import { useEffect, useState } from 'react'
import { decodeJwt } from '../auth/jwt'

/** Panel didáctico: muestra el JWT, su contenido y cuánto le queda de vida. */
export default function TokenPanel({ token }: { token: string }) {
  const decoded = decodeJwt(token)
  const now = useNow()

  if (!decoded) return <p className="alert error">El token no tiene formato JWT.</p>

  const { header, payload, parts } = decoded
  const secondsLeft = payload.exp ? payload.exp - Math.floor(now / 1000) : null

  return (
    <section className="card">
      <h2>Token actual</h2>
      <p className="muted">Solo para fines didácticos: en una app real no se muestra el token.</p>

      {/* Las tres partes del JWT con colores distintos */}
      <pre>
        <span style={{ color: '#e8590c' }}>{parts[0]}</span>.
        <span style={{ color: '#7048e8' }}>{parts[1]}</span>.
        <span style={{ color: '#0c8599' }}>{parts[2]}</span>
      </pre>

      <p>
        Expira: <strong>{payload.exp ? new Date(payload.exp * 1000).toLocaleTimeString() : '—'}</strong>
        {' · '}
        {secondsLeft === null ? null : secondsLeft > 0 ? (
          <span className="alert ok">quedan {formatSeconds(secondsLeft)}</span>
        ) : (
          <span className="alert error">
            expirado hace {formatSeconds(-secondsLeft)} (la API tolera 30 s de ClockSkew)
          </span>
        )}
      </p>

      <h3>Header</h3>
      <pre>{JSON.stringify(header, null, 2)}</pre>
      <h3>Payload (claims)</h3>
      <pre>{JSON.stringify(payload, null, 2)}</pre>
    </section>
  )
}

// Reloj que se actualiza cada segundo para la cuenta regresiva.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
