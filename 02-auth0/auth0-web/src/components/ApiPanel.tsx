import { useAuth0 } from '@auth0/auth0-react'
import { useState } from 'react'
import { config } from '../config'

interface Endpoint {
  label: string
  path: string
  withToken: boolean
  expected: string
}

const endpoints: Endpoint[] = [
  { label: 'Público', path: '/api/public', withToken: false, expected: '200 siempre' },
  { label: 'Privado', path: '/api/private', withToken: true, expected: '200 con sesión' },
  { label: 'Con permiso', path: '/api/private-scoped', withToken: true, expected: '200 con rol · 403 sin rol' },
]

interface Result {
  path: string
  status: number | string
  body: string
}

export default function ApiPanel() {
  const { getAccessTokenSilently } = useAuth0()
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  async function call(endpoint: Endpoint) {
    setBusy(true)
    try {
      const headers: HeadersInit = {}
      if (endpoint.withToken) {
        // Devuelve el access token de la caché o pide uno nuevo a Auth0 sin
        // interrumpir al usuario (por eso "silently"). Si expiró, lo renueva solo.
        const token = await getAccessTokenSilently()
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(`${config.apiUrl}${endpoint.path}`, { headers })
      const text = await response.text()
      setResult({
        path: endpoint.path,
        status: response.status,
        body: text ? JSON.stringify(JSON.parse(text), null, 2) : '(sin cuerpo)',
      })
    } catch (err) {
      setResult({
        path: endpoint.path,
        status: 'error',
        body: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  const ok = typeof result?.status === 'number' && result.status < 400

  return (
    <section className="card">
      <h2>Probar API</h2>
      <p className="muted">
        Llama a <code>{config.apiUrl}</code>. Los botones privados envían el access token en{' '}
        <code>Authorization: Bearer …</code>
      </p>
      <div className="actions">
        {endpoints.map((e) => (
          <button key={e.path} disabled={busy} onClick={() => call(e)} title={`Esperado: ${e.expected}`}>
            {e.label}
          </button>
        ))}
      </div>

      {result && (
        <>
          <p>
            <code>GET {result.path}</code> →{' '}
            <span className={`alert ${ok ? 'ok' : 'error'}`}>HTTP {result.status}</span>
          </p>
          <pre>{result.body}</pre>
        </>
      )}
    </section>
  )
}
