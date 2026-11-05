import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiFetch, ApiError } from '../api/apiFetch'

/*
 * ¿DÓNDE GUARDAR EL TOKEN EN EL NAVEGADOR?
 *
 * 1) En memoria (estado de React)  <- lo que usamos aquí
 *    + Un script malicioso (XSS) no lo encuentra en ningún almacenamiento persistente.
 *    - Se pierde al recargar la página (hay que volver a iniciar sesión).
 *
 * 2) localStorage / sessionStorage
 *    + Sobrevive a recargas, muy fácil de usar.
 *    - Cualquier JavaScript de la página puede leerlo: una vulnerabilidad XSS
 *      o una librería comprometida puede robar el token y usarlo desde otro lado.
 *
 * 3) Cookie HttpOnly + Secure + SameSite (puesta por el servidor)
 *    + JavaScript NO puede leerla: el robo por XSS se vuelve mucho más difícil.
 *    + El navegador la envía sola en cada petición.
 *    - Hay que protegerse de CSRF (SameSite, tokens anti-CSRF) y configurar CORS con credenciales.
 *    Es la opción recomendada en producción (por ejemplo con el patrón BFF).
 */

interface AuthContextValue {
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (accessToken: string, refreshToken: string) => void
  logout: () => Promise<void>
  /** apiFetch que incluye el token, renueva automáticamente ante 401 y reintenta una sola vez. */
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Los tokens viven en estado de React (memoria)
  const [token, setToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)

  // Referencias para leer el valor actual dentro de callbacks asíncronos sin problemas de closure
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token
  const refreshTokenRef = useRef<string | null>(refreshToken)
  refreshTokenRef.current = refreshToken

  const login = useCallback((accessToken: string, newRefreshToken: string) => {
    setToken(accessToken)
    setRefreshToken(newRefreshToken)
  }, [])

  const logout = useCallback(async () => {
    const currentRefresh = refreshTokenRef.current
    setToken(null)
    setRefreshToken(null)

    if (currentRefresh) {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: currentRefresh }),
        })
      } catch {
        // Ignoramos error en el backend durante el logout
      }
    }
  }, [])

  // Promesa para sincronizar llamadas simultáneas y evitar múltiples llamadas a refresh
  const refreshPromiseRef = useRef<Promise<{ accessToken: string; refreshToken: string }> | null>(null)

  const authFetch = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const currentToken = tokenRef.current

      try {
        // Primer intento con el token actual
        return await apiFetch<T>(path, init, { token: currentToken })
      } catch (err) {
        // Si no es error 401, propagar
        if (!(err instanceof ApiError) || err.status !== 401) {
          throw err
        }

        const currentRefresh = refreshTokenRef.current
        if (!currentRefresh) {
          await logout()
          throw err
        }

        // Token expirado o no autorizado: intentamos renovación automática con /api/auth/refresh
        try {
          if (!refreshPromiseRef.current) {
            refreshPromiseRef.current = apiFetch<{ accessToken: string; refreshToken: string }>(
              '/api/auth/refresh',
              {
                method: 'POST',
                body: JSON.stringify({ refreshToken: currentRefresh }),
              },
            ).finally(() => {
              refreshPromiseRef.current = null
            })
          }

          const newPair = await refreshPromiseRef.current

          // Guardamos el nuevo par rotado
          setToken(newPair.accessToken)
          setRefreshToken(newPair.refreshToken)

          // Reintentamos la petición original una sola vez con el nuevo access token
          return await apiFetch<T>(path, init, {
            token: newPair.accessToken,
            onUnauthorized: () => {
              logout()
            },
          })
        } catch (refreshErr) {
          // Si el refresh falla (ej: 401 por expirado o detección de reutilización), cerramos sesión
          await logout()
          throw refreshErr
        }
      }
    },
    [logout],
  )

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      isAuthenticated: token !== null,
      login,
      logout,
      authFetch,
    }),
    [token, refreshToken, login, logout, authFetch],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return context
}
