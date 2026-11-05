import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { apiFetch } from '../api/apiFetch'

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
 *
 * Para la demo usamos memoria: es simple y nos obliga a ver la expiración del token.
 */

interface AuthContextValue {
  token: string | null
  isAuthenticated: boolean
  login: (accessToken: string) => void
  logout: () => void
  /** apiFetch que ya incluye el token y cierra sesión ante un 401. */
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // El token vive SOLO en esta variable de estado.
  const [token, setToken] = useState<string | null>(null)

  const login = useCallback((accessToken: string) => setToken(accessToken), [])
  const logout = useCallback(() => setToken(null), [])

  const authFetch = useCallback(
    <T,>(path: string, init?: RequestInit) => apiFetch<T>(path, init, { token, onUnauthorized: logout }),
    [token, logout],
  )

  const value = useMemo(
    () => ({ token, isAuthenticated: token !== null, login, logout, authFetch }),
    [token, login, logout, authFetch],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return context
}
