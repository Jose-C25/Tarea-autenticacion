// URL base de la API, leída del archivo .env (ver .env.example).
// Solo las variables que empiezan con VITE_ llegan al navegador:
// ¡nunca pongas secretos en un .env del frontend!
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5080'

/** Error HTTP con el código de estado, para mostrarlo en la interfaz. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

export interface AuthOptions {
  /** Access token actual (si hay sesión). */
  token?: string | null
  /** Qué hacer si la API responde 401 con nuestro token (expirado o inválido). */
  onUnauthorized?: () => void
}

/**
 * fetch con JSON + header Authorization.
 * - Si hay token, agrega "Authorization: Bearer <token>".
 * - Si la API responde 401 y habíamos enviado token, el token ya no sirve
 *   (expiró o fue alterado): cerramos la sesión.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}, auth: AuthOptions = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (auth.token) headers.set('Authorization', `Bearer ${auth.token}`)

  const response = await fetch(`${API_URL}${path}`, { ...init, headers })

  // Algunas respuestas (403, 204) no traen cuerpo.
  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : null

  if (!response.ok) {
    if (response.status === 401 && auth.token) auth.onUnauthorized?.()
    throw new ApiError(response.status, extractMessage(response.status, body), body)
  }

  return body as T
}

function extractMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as { message?: string; title?: string; errors?: Record<string, string[]> }
    if (b.errors) return Object.values(b.errors).flat().join(' ')
    if (b.message) return b.message
    if (b.title) return b.title
  }
  if (status === 403) return 'No tienes permiso para esta acción.'
  if (status === 429) return 'Demasiados intentos. Espera un minuto.'
  return `Error HTTP ${status}`
}
