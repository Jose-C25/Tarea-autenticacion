import { useAuth0 } from '@auth0/auth0-react'
import { useEffect, useState } from 'react'
import { decodeJwt } from '../lib/jwt'

/**
 * Panel didáctico: decodifica el ACCESS token para compararlo con el de la Parte A.
 * Fíjate en:
 *  - alg: RS256 (asimétrico, con "kid" para buscar la llave en el JWKS) vs HS256 en la Parte A.
 *  - iss: https://{tenant}/ en lugar de http://localhost:5080.
 *  - aud: el identifier de NUESTRA API (https://api.demo-auth.local).
 *  - permissions: los permisos del rol asignado en Auth0 (RBAC).
 */
export default function AccessTokenPanel() {
  const { getAccessTokenSilently } = useAuth0()
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getAccessTokenSilently()
      .then((accessToken) => setToken(accessToken ?? null))
      .catch((err: Error) => setError(err.message))
  }, [getAccessTokenSilently])

  if (error) return <p className="alert error">No se pudo obtener el access token: {error}</p>
  if (!token) return null

  const decoded = decodeJwt(token)
  if (!decoded) {
    // Sin "audience", Auth0 entrega un token opaco (no JWT) que nuestra API no puede validar.
    return <p className="alert error">El access token no es un JWT. ¿Configuraste VITE_AUTH0_AUDIENCE?</p>
  }

  const { header, payload } = decoded

  async function copy() {
    await navigator.clipboard.writeText(token!)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="card">
      <h2>Access token (payload decodificado)</h2>
      <p className="muted">Solo para fines didácticos. Compáralo con el token de la Parte A.</p>

      <table className="claims">
        <tbody>
          <tr>
            <th>alg</th>
            <td>
              <code>{String(header.alg)}</code> · kid <code>{String(header.kid ?? '—')}</code>
            </td>
          </tr>
          <tr>
            <th>iss</th>
            <td>
              <code>{payload.iss}</code>
            </td>
          </tr>
          <tr>
            <th>aud</th>
            <td>
              <code>{JSON.stringify(payload.aud)}</code>
            </td>
          </tr>
          <tr>
            <th>permissions</th>
            <td>
              <code>{JSON.stringify(payload.permissions ?? [])}</code>
            </td>
          </tr>
          <tr>
            <th>exp</th>
            <td>{payload.exp ? new Date(payload.exp * 1000).toLocaleString() : '—'}</td>
          </tr>
        </tbody>
      </table>

      <pre>{JSON.stringify(payload, null, 2)}</pre>

      <div className="actions" style={{ marginTop: '0.75rem' }}>
        <button className="secondary" onClick={copy}>
          {copied ? '¡Copiado!' : 'Copiar token (para requests.http)'}
        </button>
      </div>
    </section>
  )
}
