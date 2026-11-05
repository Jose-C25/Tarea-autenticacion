// Configuración leída del archivo .env (ver .env.example).
export const config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN ?? '',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID ?? '',
  audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? '',
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:5080',
  // openid/profile/email -> datos del ID Token; read:messages -> permiso para nuestra API.
  scope: 'openid profile email read:messages',
}

export const isConfigured =
  config.domain !== '' &&
  config.clientId !== '' &&
  config.audience !== '' &&
  !config.domain.startsWith('tu-tenant') &&
  config.clientId !== 'tu-client-id'
