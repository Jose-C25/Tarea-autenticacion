import { Auth0Provider } from '@auth0/auth0-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { config, isConfigured } from './config.ts'
import './index.css'

const root = createRoot(document.getElementById('root')!)

if (!isConfigured) {
  root.render(
    <main className="container">
      <section className="card">
        <h1>Falta configurar Auth0</h1>
        <p>
          Copia <code>.env.example</code> como <code>.env</code>, completa los valores de tu tenant y reinicia{' '}
          <code>npm run dev</code>.
        </p>
      </section>
    </main>,
  )
} else {
  root.render(
    <StrictMode>
      {/*
        Auth0Provider implementa Authorization Code Flow + PKCE:
        1) loginWithRedirect() nos lleva a la página de login de Auth0 (Universal Login).
        2) Auth0 autentica (contraseña, Google, MFA...) y vuelve a redirect_uri con un "code".
        3) El SDK cambia ese code por los tokens (ID Token + Access Token).
        Nuestra app NUNCA ve la contraseña del usuario.

        Igual que en la Parte A, por defecto el SDK guarda los tokens EN MEMORIA
        (cacheLocation: 'memory'). Al recargar, recupera la sesión con la cookie
        de sesión de Auth0 (silent authentication), sin pedir la contraseña otra vez.
      */}
      <Auth0Provider
        domain={config.domain}
        clientId={config.clientId}
        authorizationParams={{
          redirect_uri: window.location.origin, // debe estar en "Allowed Callback URLs"
          audience: config.audience, // sin audience, Auth0 no emite un JWT para NUESTRA API
          scope: config.scope,
        }}
      >
        <App />
      </Auth0Provider>
    </StrictMode>,
  )
}
