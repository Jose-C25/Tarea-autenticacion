import { useAuth0 } from '@auth0/auth0-react'
import { useCallback, useEffect, useState } from 'react'
import { config } from '../config'
import { decodeJwt } from '../lib/jwt'

interface Message {
  id: number
  text: string
  createdBy: string
}

export default function MessagesPanel() {
  const { getAccessTokenSilently } = useAuth0()
  const [messages, setMessages] = useState<Message[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Inspeccionamos los permisos en el access token
  useEffect(() => {
    getAccessTokenSilently()
      .then((token) => {
        if (!token) {
          setPermissions([])
          return
        }
        const decoded = decodeJwt(token)
        const perms = decoded?.payload.permissions ?? []
        setPermissions(perms)
      })
      .catch(() => setPermissions([]))
  }, [getAccessTokenSilently])

  const canDelete = permissions.includes('delete:messages')
  const canRead = permissions.includes('read:messages')

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const token = await getAccessTokenSilently()
      const res = await fetch(`${config.apiUrl}/api/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data: Message[] = await res.json()
      setMessages(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  async function handleDelete(id: number) {
    setError(null)
    setSuccess(null)
    try {
      const token = await getAccessTokenSilently()
      const res = await fetch(`${config.apiUrl}/api/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      setSuccess(`Mensaje ${id} eliminado con éxito por la API (HTTP 200).`)
      // Refrescamos la lista localmente
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="card">
      <h2>Mensajes del Sistema (RBAC)</h2>
      <p className="muted">
        Permisos detectados en tu Access Token:{' '}
        <strong>{permissions.length > 0 ? permissions.join(', ') : 'Ninguno'}</strong>
      </p>

      {error && <p className="alert error">{error}</p>}
      {success && <p className="alert ok">{success}</p>}

      {!canRead && (
        <p className="alert error">
          Tu usuario no tiene el permiso <code>read:messages</code>.
        </p>
      )}

      {loading ? (
        <p>Cargando mensajes…</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem', margin: '1rem 0' }}>
          {messages.length === 0 ? (
            <p className="muted">No hay mensajes disponibles.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                }}
              >
                <div>
                  <strong>#{m.id}: {m.text}</strong>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>Creado por: {m.createdBy}</div>
                </div>

                {/* Botón Eliminar: solo visible si el usuario tiene el permiso delete:messages */}
                {canDelete ? (
                  <button
                    style={{ background: 'var(--error)', color: '#fff' }}
                    onClick={() => handleDelete(m.id)}
                  >
                    Eliminar
                  </button>
                ) : (
                  <span className="muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                    (Solo lectura: sin botón eliminar)
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div className="actions">
        <button onClick={fetchMessages} disabled={loading}>
          Recargar mensajes
        </button>
      </div>

      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          🔒 <strong>Nota de Seguridad:</strong> El botón &quot;Eliminar&quot; se oculta en la UI si falta el permiso <code>delete:messages</code>. Sin embargo, la seguridad no depende de ocultar elementos en la interfaz (seguridad por oscuridad), sino de la validación estricta de la política en el servidor Web API (<code>.RequireAuthorization(&quot;delete:messages&quot;)</code>). Si un usuario Lector intenta ejecutar un <code>DELETE</code> por HTTP directo, la API responderá <code>403 Forbidden</code>.
        </p>
      </div>
    </section>
  )
}
