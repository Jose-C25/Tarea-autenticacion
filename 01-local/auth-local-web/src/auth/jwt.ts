/*
 * Decodificar un JWT en el navegador — SOLO CON FINES DIDÁCTICOS.
 *
 * Un JWT es header.payload.firma en Base64Url. El header y el payload se pueden leer
 * sin ninguna llave: están codificados, NO cifrados. Por eso nunca se guardan
 * contraseñas ni datos sensibles dentro de un JWT.
 *
 * El frontend NO valida la firma (no tiene la llave y no debe tenerla). Quien decide
 * si un token es válido es SIEMPRE la API. Aquí solo lo mostramos para la clase.
 */

export interface JwtPayload {
  sub?: string
  email?: string
  iss?: string
  aud?: string | string[]
  exp?: number
  iat?: number
  nbf?: number
  [claim: string]: unknown
}

export interface DecodedJwt {
  header: Record<string, unknown>
  payload: JwtPayload
  parts: [string, string, string]
}

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes) // soporta tildes y ñ
}

export function decodeJwt(token: string): DecodedJwt | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    return {
      header: JSON.parse(base64UrlDecode(parts[0])),
      payload: JSON.parse(base64UrlDecode(parts[1])),
      parts: parts as [string, string, string],
    }
  } catch {
    return null
  }
}
