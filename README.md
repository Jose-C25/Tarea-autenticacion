# Tarea: Autenticación, Refresh Tokens y Roles con Auth0

Este repositorio contiene la solución completa de la tarea de autenticación y autorización para aplicaciones web:

| Parte | Tema principal | Backend | Frontend |
|---|---|---|---|
| **Parte 1 · 01-local** | Refresh tokens rotativos con detección de reutilización, revocación, hashing SHA-256 y rate limiting por IP | `Auth.Local.Api` (.NET 10, Minimal APIs, EF Core + SQLite) | `auth-local-web` (React + Vite + TypeScript) |
| **Parte 2 · 02-auth0** | RBAC con Auth0, roles (Lector, Administrador), permisos (`read:messages`, `delete:messages`) y auditoría | `Auth.Auth0.Api` (.NET 10, Minimal APIs) | `auth0-web` (React + Vite + TypeScript + `@auth0/auth0-react`) |

```text
├── 01-local/
│   ├── Auth.Local.Api/        # API: register, login, refresh, logout, profile, 2FA (requests.http)
│   └── auth-local-web/        # React: login con rotación automática ante 401, panel de tokens
├── 02-auth0/
│   ├── Auth.Auth0.Api/        # API con Auth0: /api/messages (GET/DELETE), logging de sub
│   └── auth0-web/             # React con Auth0: RBAC en UI, lista de mensajes, permisos en JWT
└── README.md
```

> **Nota sobre puertos:** Ambos proyectos están configurados para correr la API en `http://localhost:5080` y el frontend en `http://localhost:5173`. Deben ejecutarse por separado.
> **Regla de seguridad:** Ningún secreto está versionado en Git. La API utiliza `dotnet user-secrets` y los frontends leen sus configuraciones desde `.env` basados en `.env.example`.

---

## Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) (`dotnet --version` muestra 10.0.x)
- [Node.js](https://nodejs.org/) (versión LTS o 20+) y npm
- Visual Studio Code con extensión **REST Client** o cliente HTTP equivalente (Postman / Bruno)
- Cuenta en [Auth0](https://auth0.com/) para la Parte 2

---

## Parte 1 · 01-local (Refresh Tokens y Rate Limiting)

### 1. Configurar User Secrets (llave JWT)
La clave de firmado HMAC-SHA256 se almacena fuera del repositorio en el almacén de secretos del usuario:

```powershell
cd 01-local\Auth.Local.Api
dotnet user-secrets set "Jwt:Key" "ClaveSuperSecretaParaFirmarJWTsSegurosEnEstaTarea2026!#"
dotnet user-secrets list
```

### 2. Ejecutar la Web API local
```powershell
cd 01-local\Auth.Local.Api
dotnet run
```
* La base de datos SQLite (`auth.db`) se genera automáticamente al iniciar con las tablas `Users` y `RefreshTokens`.
* Si deseas limpiar la base de datos para comenzar de cero, detén el proceso y elimina el archivo `auth.db`.

#### Endpoints de la API Local
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | Anónimo | Estado y hora del servidor |
| `POST` | `/api/auth/register` | Anónimo | Registro con contraseña hasheada (PBKDF2) |
| `POST` | `/api/auth/login` | Anónimo (Rate limit: 5/min) | Login: retorna `accessToken` (15 min) y `refreshToken` (7 días) |
| `POST` | `/api/auth/refresh` | Anónimo | Valida refresh token, lo revoca, entrega nuevo par (rotación) o 401 si hubo reutilización |
| `POST` | `/api/auth/logout` | Anónimo | Revoca el refresh token especificado |
| `GET` | `/api/profile` | Bearer (Access Token) | Retorna datos del perfil de usuario |
| `POST` | `/api/auth/2fa/setup` | Bearer | Genera secreto TOTP y URI otpauth |
| `POST` | `/api/auth/2fa/enable` | Bearer | Confirma configuración 2FA con código de 6 dígitos |
| `POST` | `/api/auth/2fa/verify` | Anónimo (Rate limit: 5/min) | Segundo paso de login con código 2FA; retorna par de tokens |

### 3. Ejecutar el Frontend Local
```powershell
cd 01-local\auth-local-web
Copy-Item .env.example .env
npm install
npm run dev
```
Abre `http://localhost:5173` en el navegador.

---

## Parte 2 · 02-auth0 (Roles y Permisos con Auth0)

### 1. Configuración en el Dashboard de Auth0
1. **Crear API en Auth0:**
   - *Applications → APIs → Create API*
   - Nombre: `Demo Auth API`
   - Identifier: `https://api.demo-auth.local`
   - Signing Algorithm: `RS256`
   - En *Settings → RBAC Settings*: Activar **Enable RBAC** y **Add Permissions in the Access Token**. Guardar cambios.
2. **Crear Permisos en la API:**
   - Pestaña *Permissions*:
     - `read:messages` (Descripción: *Leer mensajes*)
     - `delete:messages` (Descripción: *Eliminar mensajes*)
3. **Crear Roles:**
   - *User Management → Roles → Create Role*:
     - `Lector`: Asignar permiso `read:messages`.
     - `Administrador`: Asignar permisos `read:messages` y `delete:messages`.
4. **Crear Usuarios y Asignar Roles:**
   - Crear Usuario 1 (ej: `lector@demo.com`) y asignarle el rol `Lector`.
   - Crear Usuario 2 (ej: `admin@demo.com`) y asignarle el rol `Administrador`.
5. **Crear Aplicación SPA:**
   - *Applications → Create Application → Single Page Web Applications* (`Demo Auth Web`).
   - Allowed Callback URLs: `http://localhost:5173`
   - Allowed Logout URLs: `http://localhost:5173`
   - Allowed Web Origins: `http://localhost:5173`
   - Copiar *Domain* y *Client ID*.

### 2. Configurar y Ejecutar la Web API con Auth0
```powershell
cd 02-auth0\Auth.Auth0.Api
dotnet user-secrets set "Auth0:Domain" "TU-TENANT.us.auth0.com"
dotnet run
```

#### Endpoints de Mensajes y Autorización
| Método | Ruta | Requisito | Respuestas |
|---|---|---|---|
| `GET` | `/api/messages` | Permiso `read:messages` | 200 OK con lista de mensajes, 401 si no hay token, 403 si no tiene permiso |
| `DELETE` | `/api/messages/{id}` | Permiso `delete:messages` | 200 OK (registra el claim `sub` en el log de auditoría), 403 Forbidden para Lector |

### 3. Configurar y Ejecutar el Frontend de Auth0
```powershell
cd 02-auth0\auth0-web
Copy-Item .env.example .env
```
Edita `.env` con los valores de tu tenant:
```env
VITE_AUTH0_DOMAIN=tu-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=tu-client-id
VITE_AUTH0_AUDIENCE=https://api.demo-auth.local
VITE_API_URL=http://localhost:5080
```
Inicia la aplicación:
```powershell
npm install
npm run dev
```

---

## Pruebas Automatizadas con Archivos .http
- **Parte 1:** [01-local/Auth.Local.Api/requests.http](01-local/Auth.Local.Api/requests.http) contiene el flujo completo de registro, login, refresh rotativo, intento de reutilización (401), cierre de sesión y rate limiting (429).
- **Parte 2:** [02-auth0/Auth.Auth0.Api/requests.http](02-auth0/Auth.Auth0.Api/requests.http) incluye las solicitudes con tokens de rol Lector (403 al borrar) y Administrador (200 al borrar y auditoría).
