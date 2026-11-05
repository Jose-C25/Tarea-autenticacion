# demo-auth · Autenticación en aplicaciones web

Demo en vivo para la clase de Desarrollo Web sobre autenticación. Tiene dos partes que se ejecutan **por separado** (usan los mismos puertos):

| Parte | Qué muestra | Backend | Frontend |
|---|---|---|---|
| **A · 01-local** | Autenticación hecha por nosotros: registro, hash de contraseñas, JWT HS256, CORS, rate limiting y 2FA con TOTP | `Auth.Local.Api` (.NET 10, Minimal APIs, EF Core + SQLite) | `auth-local-web` (React + Vite + TS) |
| **B · 02-auth0** | Autenticación delegada a un proveedor de identidad (Auth0): OIDC + PKCE, JWKS/RS256, permisos (RBAC), MFA y login social | `Auth.Auth0.Api` (.NET 10, Minimal APIs) | `auth0-web` (React + Vite + TS + `@auth0/auth0-react`) |

```text
demo-auth/
├── 01-local/
│   ├── Auth.Local.Api/        # API: register, login, profile, 2FA  (requests.http incluido)
│   └── auth-local-web/        # React: Registro, Login, Perfil, Seguridad
├── 02-auth0/
│   ├── Auth.Auth0.Api/        # API: public, private, private-scoped (requests.http incluido)
│   └── auth0-web/             # React: login con Auth0, perfil, probar API
├── README.md                  # este archivo
└── GUION-DEMO.md              # guion paso a paso para el docente
```

**Puertos fijos:** APIs en `http://localhost:5080`, React en `http://localhost:5173`.

## Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) (`dotnet --list-sdks` debe mostrar una 10.0.x)
- [Node.js LTS](https://nodejs.org/) (22 o superior) y npm
- Para probar las APIs: VS Code con la extensión **REST Client** (o Visual Studio / Rider, que abren `.http` de forma nativa)
- Una app autenticadora en el celular (Google Authenticator, Microsoft Authenticator, Authy…) para el 2FA
- Una cuenta gratuita de [Auth0](https://auth0.com/) para la Parte B

## Parte A · Autenticación local

### 1. Configurar la llave JWT (una sola vez)

La llave con la que se firman los JWT **no** está en el repositorio. Se guarda con `dotnet user-secrets` (fuera de la carpeta del proyecto, en el perfil del usuario):

```bash
cd 01-local/Auth.Local.Api
# Cualquier texto aleatorio de 32+ caracteres. Por ejemplo, con PowerShell:
#   [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
dotnet user-secrets set "Jwt:Key" "PEGA_AQUI_UNA_LLAVE_ALEATORIA_DE_AL_MENOS_32_CARACTERES"
dotnet user-secrets list
```

Si falta la llave, la API **no arranca** y muestra: `Jwt:Key debe tener al menos 32 caracteres...`.

### 2. Ejecutar la API

```bash
cd 01-local/Auth.Local.Api
dotnet run
```

- Crea `auth.db` (SQLite) automáticamente la primera vez. Para empezar de cero: detén la API y borra `auth.db`.
- Prueba los endpoints con [01-local/Auth.Local.Api/requests.http](01-local/Auth.Local.Api/requests.http).
- Para ver la expiración del token rápido: `dotnet run -- --Jwt:AccessTokenMinutes=1`.

| Método | Ruta | Auth | Respuestas |
|---|---|---|---|
| GET | `/api/health` | anónimo | 200 |
| POST | `/api/auth/register` | anónimo | 201, 400, 409 |
| POST | `/api/auth/login` | anónimo (5/min por IP) | 200 `{ accessToken }` o `{ requires2fa, tempToken }`, 401, 429 |
| GET | `/api/profile` | Bearer | 200, 401, 403 (tempToken) |
| POST | `/api/auth/2fa/setup` | Bearer | 200 `{ secret, otpauthUri }`, 409 |
| POST | `/api/auth/2fa/enable` | Bearer | 200, 400 |
| POST | `/api/auth/2fa/verify` | anónimo (5/min por IP) | 200 `{ accessToken }`, 401, 429 |

### 3. Ejecutar el frontend

```bash
cd 01-local/auth-local-web
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

`.env` solo contiene `VITE_API_URL=http://localhost:5080`.

## Parte B · Auth0

> Detén la Parte A antes (mismos puertos). Primero completa la [Configuración de Auth0](#configuración-de-auth0).

### 1. Ejecutar la API

```bash
cd 02-auth0/Auth.Auth0.Api
dotnet user-secrets set "Auth0:Domain" "tu-tenant.us.auth0.com"
dotnet run
```

`Auth0:Audience` ya está en `appsettings.json` (`https://api.demo-auth.local`). Aquí **no hay llave secreta**: la API valida las firmas RS256 con las llaves públicas que Auth0 publica en `https://tu-tenant.us.auth0.com/.well-known/jwks.json`.

| Método | Ruta | Auth | Respuestas |
|---|---|---|---|
| GET | `/api/public` | anónimo | 200 |
| GET | `/api/private` | Bearer de Auth0 | 200, 401 |
| GET | `/api/private-scoped` | Bearer + permiso `read:messages` | 200, 401, 403 |

Prueba con [02-auth0/Auth.Auth0.Api/requests.http](02-auth0/Auth.Auth0.Api/requests.http) (el token se copia desde el frontend).

### 2. Ejecutar el frontend

```bash
cd 02-auth0/auth0-web
cp .env.example .env        # y edita los valores
npm install
npm run dev                 # http://localhost:5173
```

| Variable | Dónde se obtiene |
|---|---|
| `VITE_AUTH0_DOMAIN` | Applications → *tu SPA* → Settings → **Domain** |
| `VITE_AUTH0_CLIENT_ID` | Applications → *tu SPA* → Settings → **Client ID** |
| `VITE_AUTH0_AUDIENCE` | Applications → APIs → *tu API* → **Identifier** (`https://api.demo-auth.local`) |
| `VITE_API_URL` | `http://localhost:5080` |

Ninguno de estos valores es secreto (una SPA no puede guardar secretos; por eso usa Authorization Code + PKCE sin *client secret*). Aun así el `.env` no se versiona porque depende de cada tenant.

## Configuración de Auth0

Checklist manual en el [dashboard de Auth0](https://manage.auth0.com/):

- [ ] **Crear un tenant** (por ejemplo `demo-auth-umg`, región US). Anota el dominio: `demo-auth-umg.us.auth0.com`.
- [ ] **Application tipo SPA**: *Applications → Applications → Create Application → Single Page Web Applications* (nombre: `Demo Auth Web`). En *Settings*:
  - Allowed Callback URLs: `http://localhost:5173`
  - Allowed Logout URLs: `http://localhost:5173`
  - Allowed Web Origins: `http://localhost:5173`
  - Guarda los cambios (*Save Changes*) y copia **Domain** y **Client ID** al `.env`.
- [ ] **API**: *Applications → APIs → Create API*
  - Name: `Demo Auth API`
  - Identifier: `https://api.demo-auth.local` (es solo un identificador; no tiene que existir esa URL)
  - Signing Algorithm: `RS256`
- [ ] En la API → pestaña *Settings* → **RBAC Settings**: activar **Enable RBAC** y **Add Permissions in the Access Token**. Guardar.
- [ ] En la API → pestaña *Permissions*: crear el permiso **`read:messages`** (descripción: “Leer mensajes”).
- [ ] Si tu tenant muestra la pestaña *Application Access* en la API, verifica que la SPA `Demo Auth Web` tenga permitido el acceso **de usuario** a la API.
- [ ] **Rol**: *User Management → Roles → Create Role* (`Lector`) → pestaña *Permissions* → *Add Permissions* → `Demo Auth API` → `read:messages`.
- [ ] **Usuarios**: *User Management → Users → Create User* (conexión `Username-Password-Authentication`).
  - Usuario **con** rol: pestaña *Roles* → *Assign Roles* → `Lector`.
  - Crea un **segundo usuario sin rol** para mostrar el 403.
- [ ] **MFA con One-time Password**: *Security → Multi-factor Auth* → activar **One-time Password** → en *Define policies* elegir **Always** (o *Adaptive* si prefieres). Guardar. El primer login pedirá enrolar la app autenticadora con un QR (lo mismo que hicimos a mano en la Parte A).
- [ ] **Login social con Google**: *Authentication → Social → Google / Gmail* (conexión `google-oauth2`) activada, y en *Applications → Demo Auth Web → Connections* habilitar `google-oauth2`. Las “dev keys” de Auth0 sirven para la demo (muestran una advertencia); en producción se usan credenciales propias de Google Cloud.

> Al iniciar sesión desde `localhost`, Auth0 muestra una pantalla de **consentimiento** (“Demo Auth Web quiere acceder a…”) la primera vez. Es normal: en `localhost` Auth0 no permite omitirla.

## Etiquetas (tags) para la clase

Cada paso es un commit con su tag. Durante la clase se puede saltar a cualquier punto:

```bash
git checkout parteA-paso05     # el repositorio queda en ese paso (HEAD separado)
git switch -                   # volver a la rama
```

| Tag | Contenido |
|---|---|
| `parteA-paso01` | API base, EF Core + SQLite, entidad `User`, `/api/health` |
| `parteA-paso02` | `POST /api/auth/register` con validación y `PasswordHasher` |
| `parteA-paso03` | `TokenService` (JWT HS256) y `JwtOptions` |
| `parteA-paso04` | `POST /api/auth/login` con 401 genérico |
| `parteA-paso05` | Validación JWT Bearer y `GET /api/profile` |
| `parteA-paso06` | Política CORS `web` |
| `parteA-paso07` | Rate limiting en el login (429) |
| `parteA-paso08` | 2FA con TOTP (setup, enable, verify, tempToken) |
| `parteA-paso09` | React: `AuthContext` en memoria y `apiFetch` |
| `parteA-paso10` | Páginas Registro, Login, Perfil y panel “Token actual” |
| `parteA-paso11` | Página Seguridad (QR) y login en dos pasos |
| `parteB-paso01` | API Auth0 base con CORS |
| `parteB-paso02` | JWT Bearer con Authority/Audience de Auth0 |
| `parteB-paso03` | `/api/public`, `/api/private`, `/api/private-scoped` |
| `parteB-paso04` | React con `Auth0Provider` |
| `parteB-paso05` | Barra de sesión y tarjeta de perfil |
| `parteB-paso06` | Panel “Probar API” y payload del access token |

El guion detallado está en [GUION-DEMO.md](GUION-DEMO.md).

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| La API no arranca: `Jwt:Key debe tener al menos 32 caracteres` | Falta `dotnet user-secrets set "Jwt:Key" ...` en `Auth.Local.Api`. |
| La API Auth0 no arranca: `Falta configurar Auth0` | Falta `dotnet user-secrets set "Auth0:Domain" ...` en `Auth.Auth0.Api`. |
| `Address already in use` / `Port 5173 is in use` | Hay otra parte corriendo. Detén la API (Ctrl+C) y el `npm run dev` anteriores. |
| Error CORS en la consola del navegador | El frontend no corre en `http://localhost:5173` exacto (no `127.0.0.1`). |
| El código 2FA siempre es inválido | La hora del celular o del PC está desfasada. Activa la hora automática. |
| Auth0: `Callback URL mismatch` | Revisa *Allowed Callback URLs* = `http://localhost:5173` (sin `/` final). |
| Auth0: `Service not found: https://api.demo-auth.local` | La API no existe en Auth0 o el Identifier no coincide con `VITE_AUTH0_AUDIENCE`. |
| `/api/private-scoped` da 403 a un usuario con rol | Falta *Add Permissions in the Access Token*, o el usuario debe cerrar sesión y volver a entrar para recibir un token nuevo. |
