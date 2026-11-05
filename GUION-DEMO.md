# Guion de la demo · Autenticación

Guion para el docente, en el orden de los tags. En cada paso: **abrir** (archivos), **explicar**, **ejecutar**, **probar** y **resultado esperado**. Los bloques 💥 son *momentos de error intencional* para mostrar en clase.

Rutas relativas a `Clase15/demo-auth/`. Para saltar a un paso: `git checkout <tag>`; para volver: `git switch -`.

---

## Antes de la clase (checklist)

- [ ] `dotnet --list-sdks` muestra 10.0.x · `node -v` ≥ 22.
- [ ] `cd 01-local/Auth.Local.Api && dotnet user-secrets set "Jwt:Key" "<llave aleatoria de 32+ caracteres>"`.
- [ ] `npm install` en `01-local/auth-local-web` y `02-auth0/auth0-web` (con la rama en el último commit, para tener todas las dependencias).
- [ ] `.env` creados a partir de `.env.example` en ambos frontends.
- [ ] Tenant de Auth0 configurado (ver checklist del [README](README.md#configuración-de-auth0)) con **dos usuarios**: uno con rol `Lector` y otro sin rol.
- [ ] `dotnet user-secrets set "Auth0:Domain" "tu-tenant.us.auth0.com"` en `02-auth0/Auth.Auth0.Api`.
- [ ] App autenticadora instalada en el celular.
- [ ] VS Code con la extensión REST Client. Borrar `01-local/Auth.Local.Api/auth.db` para empezar limpio.
- [ ] Tener abierto [jwt.io](https://jwt.io) en una pestaña (opcional).

---

# PARTE A · Autenticación local (`01-local`)

Idea central: **nosotros** somos responsables de todo: guardar contraseñas, emitir tokens, validarlos y protegernos de ataques.

## `parteA-paso01` · API base, EF Core + SQLite

- **Abrir:** `Auth.Local.Api/Models/User.cs`, `Data/AppDbContext.cs`, `Program.cs`.
- **Explicar:**
  - `User` guarda `PasswordHash`, nunca la contraseña. `TotpSecret` y `TwoFactorEnabled` quedan listos para el 2FA.
  - Índice único en `Email`.
  - `EnsureCreated()` crea `auth.db` al iniciar (en un proyecto real: migraciones).
  - Puerto fijo 5080 en `Properties/launchSettings.json`.
- **Ejecutar:** `cd 01-local/Auth.Local.Api` → `dotnet run`
- **Probar:** `requests.http` → *Salud de la API*.
- **Resultado esperado:** `200 {"status":"ok", ...}` y aparece el archivo `auth.db`.

## `parteA-paso02` · Registro

- **Abrir:** `Endpoints/AuthEndpoints.cs` (método `Register`), `Contracts/AuthDtos.cs`.
- **Explicar:**
  - DTOs: nunca exponemos la entidad completa.
  - Validación en el servidor (aunque el frontend también valide).
  - `PasswordHasher<User>`: PBKDF2 + sal aleatoria + muchas iteraciones → dos usuarios con la misma contraseña tienen hashes distintos.
  - Normalizar el correo (`Ana@Demo.com` = `ana@demo.com`).
- **Ejecutar:** reiniciar la API (Ctrl+C, `dotnet run`).
- **Probar:** *Registro de usuario* (dos veces) y *Registro inválido*.
- **Resultado esperado:** `201` la primera vez · **`409`** la segunda · **`400`** con los errores de correo y contraseña.
- **Extra:** abrir `auth.db` (extensión SQLite de VS Code) y mostrar el `PasswordHash` (`AQAAAAIAAYag...`).

## `parteA-paso03` · Emisión de JWT

- **Abrir:** `Auth/JwtOptions.cs`, `Auth/TokenService.cs`, `appsettings.json`, `Program.cs` (bloque `AddOptions<JwtOptions>`).
- **Explicar:**
  - Opciones tipadas: `Issuer`, `Audience`, minutos en `appsettings.json`; la **llave** en user-secrets.
  - `ValidateOnStart`: sin llave, la API no arranca (fallar temprano).
  - HS256 = la misma llave firma y verifica → nunca sale del servidor.
  - Claims `sub`, `email`, `jti`; `exp` a 15 minutos.
  - El payload **no está cifrado**: es Base64Url.
- **Ejecutar:** `dotnet user-secrets list` (mostrar que la llave está fuera del repo) y `git status` (no aparece).
- 💥 **Error intencional (opcional):** `dotnet user-secrets remove "Jwt:Key"` → `dotnet run` → la API **no arranca** con el mensaje de validación. Volver a configurarla.
- **Resultado esperado:** compila; todavía no hay endpoint que emita tokens.

## `parteA-paso04` · Login

- **Abrir:** `Endpoints/AuthEndpoints.cs` (método `Login`).
- **Explicar:**
  - Mensaje **genérico** 401: no revelamos si el correo existe.
  - `DummyUser`: aunque el usuario no exista, calculamos un hash para que el tiempo de respuesta sea igual (evita enumeración por tiempos).
  - `SuccessRehashNeeded`: actualizar hashes antiguos.
- **Probar:** *Login correcto*, *contraseña incorrecta*, *usuario inexistente*.
- **Resultado esperado:** `200 { accessToken }` · `401` · `401` con **el mismo mensaje**.
- **Extra:** pegar el `accessToken` en jwt.io → ver header (`HS256`), payload (`sub`, `email`, `iss`, `aud`, `exp`) y “Invalid Signature” (jwt.io no conoce la llave).

## `parteA-paso05` · Validación JWT y endpoint protegido

- **Abrir:** `Auth/JwtBearerSetup.cs`, `Endpoints/ProfileEndpoints.cs`, `Program.cs` (`AddAuthentication`, `UseAuthentication`, `UseAuthorization`).
- **Explicar:**
  - Las 4 validaciones: issuer, audience, lifetime, firma.
  - `ClockSkew` de 30 s (por defecto son 5 minutos).
  - `MapInboundClaims = false` para conservar `sub` y `email`.
  - Autenticación (¿quién eres?) antes que autorización (¿qué puedes hacer?).
  - `/api/profile` no consulta la BD: lee los claims.
- **Probar:** *Login correcto* y luego *Perfil CON token*.
- **Resultado esperado:** `200 {"id":"1","email":"ana@demo.com"}`.

💥 **Momentos de error intencional**

| Prueba (`requests.http`) | Resultado | Qué explicar |
|---|---|---|
| *Perfil SIN token* | **401** | No hay identidad. |
| *Token modificado a mano*: copiar el token, cambiar una letra del payload (parte del medio) | **401** · `WWW-Authenticate: Bearer error="invalid_token"` | La firma ya no coincide: el payload es legible pero **no modificable**. |
| *Token expirado*: reiniciar con `dotnet run -- --Jwt:AccessTokenMinutes=1`, hacer login, esperar ~1,5 min | **401** · `error_description="The token expired at ..."` | `exp` + 30 s de `ClockSkew`. |

## `parteA-paso06` · CORS

- **Abrir:** `Program.cs` (`AddCors`, `UseCors("web")`).
- **Explicar:**
  - Mismo origen = esquema + host + puerto. `5173` ≠ `5080`.
  - Preflight `OPTIONS` antes de un `GET` con `Authorization`.
  - CORS lo aplica el **navegador**; no protege la API de `curl` ni de Postman.
  - Nunca `AllowAnyOrigin()` en una API con credenciales.
- **Probar:** las dos peticiones `OPTIONS` de `requests.http`.
- **Resultado esperado:** origen `http://localhost:5173` → **204** con `Access-Control-Allow-Origin: http://localhost:5173` · origen `http://sitio-malicioso.com` → **204 sin** esa cabecera (el navegador bloquea la respuesta).

## `parteA-paso07` · Rate limiting

- **Abrir:** `Program.cs` (`AddRateLimiter`, `UseRateLimiter`), `AuthEndpoints.cs` (`RequireRateLimiting`), `Auth/RateLimitPolicies.cs`.
- **Explicar:**
  - Fuerza bruta / *credential stuffing*.
  - Ventana fija: 5 intentos por minuto **por IP** (partición).
  - Solo en el login, no en toda la API.
  - Detrás de un proxy hay que usar `ForwardedHeaders` para ver la IP real.
- 💥 **Probar:** *rate limiting* → ejecutar la petición **6 veces seguidas**.
- **Resultado esperado:** 401, 401, 401, 401, 401 y luego **429** con `Retry-After: 60` y el mensaje “Demasiados intentos…”. (Los logins correctos del mismo minuto también cuentan.) Esperar un minuto antes de seguir.

## `parteA-paso08` · 2FA con TOTP

- **Abrir:** `Auth/TotpHelper.cs`, `Endpoints/TwoFactorEndpoints.cs`, `Auth/TokenService.cs` (`CreateTwoFactorToken`, `ValidateTwoFactorTokenAsync`), `Program.cs` (política `FullSession` como política por defecto), `Auth/AuthConstants.cs`.
- **Explicar:**
  - Factores: algo que **sabes** (contraseña) + algo que **tienes** (celular).
  - TOTP = HMAC(secreto, hora / 30 s) → 6 dígitos. Servidor y app calculan lo mismo sin comunicarse.
  - Secreto de 20 bytes en Base32 y URI `otpauth://` (lo que va dentro del QR).
  - `enable` exige un código válido antes de activar (evita que el usuario quede fuera de su cuenta).
  - `RfcSpecifiedNetworkDelay`: tolera ±1 ventana de 30 s.
  - Login con 2FA → `{ requires2fa: true, tempToken }`. El tempToken dura 5 min y tiene `"purpose": "2fa"`.
  - La política por defecto rechaza tokens con `purpose`: el tempToken **no sirve** para `/api/profile`.
  - `/2fa/verify` también tiene rate limiting (adivinar 6 dígitos).
  - En producción el `TotpSecret` se guarda **cifrado** (Data Protection API) y se evita reutilizar un código.
- **Probar** (sección *2FA* de `requests.http`, usuario `beto`):
  1. *2FA.1* registro → `201`
  2. *2FA.2* login → `200 { accessToken }`
  3. *2FA.3* setup → `200 { secret, otpauthUri }`. Agregar el `secret` en la app autenticadora (“Ingresar clave de configuración”, tipo *basado en tiempo*).
  4. *2FA.4* enable con el código de la app → `200` (código incorrecto → **400**)
  5. *2FA.5* login → `200 { requires2fa: true, tempToken }`
  6. 💥 *usar el tempToken en /api/profile* → **403**. Explicar: el token es auténtico (bien firmado), pero **no está autorizado** para ese endpoint. 401 = no sé quién eres; 403 = sé quién eres, pero no puedes.
  7. *2FA.6* verify con tempToken + código → `200 { accessToken }` (código incorrecto → **401**)
  8. *2FA.7* perfil con el token final → `200`

## `parteA-paso09` · React: AuthContext y apiFetch

- **Abrir:** `auth-local-web/src/auth/AuthContext.tsx` (comentario inicial), `src/api/apiFetch.ts`, `src/main.tsx`, `.env.example`, `vite.config.ts`.
- **Explicar:**
  - Comparación **memoria vs localStorage vs cookie HttpOnly** (comentario del archivo): XSS, CSRF, persistencia.
  - El token vive en un `useState`: si recargas la página, se pierde la sesión.
  - `apiFetch` agrega `Authorization: Bearer` y ante un **401** con token cierra la sesión.
  - Solo las variables `VITE_*` llegan al navegador: **nunca** secretos en el `.env` del frontend.
- **Ejecutar:** con la API corriendo: `cd 01-local/auth-local-web` → `npm run dev` → abrir http://localhost:5173.
- **Resultado esperado:** la página de inicio muestra “estado: **ok**” (la llamada a `/api/health` pasó CORS).
- 💥 **Opcional:** detener la API y recargar → “sin conexión”.

## `parteA-paso10` · Registro, Login, Perfil y panel del token

- **Abrir:** `src/pages/LoginPage.tsx`, `src/components/ProtectedRoute.tsx`, `src/pages/ProfilePage.tsx`, `src/components/TokenPanel.tsx`, `src/auth/jwt.ts`.
- **Explicar:**
  - `ProtectedRoute` es solo UX: la seguridad real está en la API.
  - El panel decodifica el JWT **sin** validar la firma (solo la API puede).
  - Cuenta regresiva hasta `exp`.
- **Probar en el navegador:**
  1. Ir a */perfil* sin sesión → redirige a */login*.
  2. Registro → Login → Perfil: se ve la respuesta de `/api/profile`, el token en 3 colores (header.payload.firma) y su payload.
  3. DevTools → *Application → Local Storage*: **vacío** (el token está en memoria).
  4. Recargar la página (F5) → se pierde la sesión.
- 💥 **Token expirado en el navegador:** reiniciar la API con `dotnet run -- --Jwt:AccessTokenMinutes=1`, iniciar sesión, esperar a que el panel diga “expirado hace 0:30” y pulsar *Volver a llamar /api/profile* → **401** → `apiFetch` cierra la sesión y te manda a */login*.
- 💥 **Rate limiting en la UI:** 6 logins fallidos → “429: Demasiados intentos…”.

## `parteA-paso11` · Seguridad (2FA) y login en dos pasos

- **Abrir:** `src/pages/SecurityPage.tsx`, `src/pages/LoginPage.tsx` (tipo `LoginResponse` y `handleCode`).
- **Explicar:**
  - `qrcode.react` convierte la `otpauthUri` en QR. El secreto en Base32 para ingreso manual.
  - El login responde de dos formas; si llega `requires2fa`, se muestra el segundo paso.
- **Probar en el navegador:**
  1. Iniciar sesión con un usuario sin 2FA → *Seguridad* → *Activar 2FA* → escanear el **QR** con el celular → escribir el código → “2FA activado”.
  2. *Cerrar sesión* → iniciar sesión otra vez → pide el código → abrir “Ver payload del tempToken” y mostrar `"purpose": "2fa"`.
  3. Código incorrecto → **401** · código correcto → Perfil.
  4. Pulsar *Activar 2FA* otra vez → **409** “El 2FA ya está activado”.

**Cierre de la Parte A:** todo esto lo tuvimos que construir y mantener nosotros (hash, llaves, expiración, 2FA, rate limiting, recuperación de contraseña, bloqueo de cuentas…). → Motivación para la Parte B.

---

# PARTE B · Auth0 (`02-auth0`)

Idea central: **delegamos** la identidad a un proveedor (IdP). Nuestra API ya no ve contraseñas ni guarda llaves: solo **valida** tokens.

> Detener la API y el frontend de la Parte A (mismos puertos).

## `parteB-paso01` · API base con CORS

- **Abrir:** `02-auth0/Auth.Auth0.Api/Program.cs`, `Properties/launchSettings.json`.
- **Explicar:** mismo esqueleto que la Parte A; no hay base de datos de usuarios.
- **Ejecutar:** `cd 02-auth0/Auth.Auth0.Api` → `dotnet run`
- **Probar:** *Salud de la API* y el `OPTIONS` de `requests.http`.
- **Resultado esperado:** `200` y `204` con `Access-Control-Allow-Origin`.

## `parteB-paso02` · JWT Bearer con Auth0

- **Abrir:** `Program.cs` (bloque `AddJwtBearer`), `appsettings.json`.
- **Explicar:**
  - `Authority = https://{dominio}/` → la API descarga `/.well-known/openid-configuration` y de ahí el **JWKS**.
  - **RS256 asimétrico:** Auth0 firma con la llave privada; la API verifica con la pública. **No hay secreto en la API** (comparar con `Jwt:Key` de la Parte A).
  - `Audience`: el token debe ser emitido **para esta API**.
  - Rotación automática de llaves (`kid` del header).
- **Ejecutar:** `dotnet user-secrets set "Auth0:Domain" "tu-tenant.us.auth0.com"` → `dotnet run`.
- **Mostrar en el navegador:** `https://tu-tenant.us.auth0.com/.well-known/openid-configuration` y `https://tu-tenant.us.auth0.com/.well-known/jwks.json`.
- 💥 **Opcional:** `dotnet user-secrets remove "Auth0:Domain"` → la API no arranca con “Falta configurar Auth0”.

## `parteB-paso03` · Endpoints public / private / private-scoped

- **Abrir:** `Program.cs` (política `read:messages` y los tres `MapGet`).
- **Explicar:**
  - RBAC: rol `Lector` → permiso `read:messages` → claim `permissions` en el access token.
  - `RequireClaim("permissions", "read:messages")`.
  - 401 vs 403 otra vez.
- **Probar:** `requests.http` → *Público* y *privado SIN token*.
- **Resultado esperado:** `/api/public` → **200** · `/api/private` sin token → **401**. (Las pruebas con token se hacen después del paso 6.)
- 💥 **Opcional:** *token de la Parte A en esta API* → **401** (otra firma, otro `iss`, otra `aud`).

## `parteB-paso04` · React con Auth0Provider

- **Abrir:** `02-auth0/auth0-web/src/main.tsx`, `src/config.ts`, `.env.example`.
- **Explicar:**
  - Authorization Code Flow + **PKCE**: la SPA no tiene client secret.
  - `redirect_uri`, `audience` (sin audience → token opaco que la API no puede validar), `scope: openid profile email read:messages`.
  - El SDK también guarda los tokens en **memoria** por defecto.
- **Ejecutar:** `cd 02-auth0/auth0-web` → `npm run dev`.
- **Resultado esperado:** “❌ Sin sesión” con el dominio del tenant. Si el `.env` no está configurado, aparece “Falta configurar Auth0”.

## `parteB-paso05` · Login, logout y perfil

- **Abrir:** `src/components/NavBar.tsx`, `src/components/ProfileCard.tsx`, `src/App.tsx`.
- **Explicar:**
  - `loginWithRedirect()` → Universal Login de Auth0 (nuestra app nunca ve la contraseña).
  - `logout({ logoutParams: { returnTo } })` cierra también la sesión de Auth0.
  - **ID Token** (para el frontend: nombre, foto, email) vs **Access Token** (para la API).
  - `isLoading` mientras se procesa el `?code=` del callback; `error` para fallos de Auth0.
- **Probar en el navegador:**
  1. *Iniciar sesión* → URL de Auth0 → login con el usuario **con rol** → (primera vez) pantalla de consentimiento y **enrolamiento de MFA** con QR → código → vuelve a la app con foto, nombre y email.
  2. Mostrar en DevTools → *Network* el intercambio `/oauth/token` (code + `code_verifier` de PKCE).
  3. *Cerrar sesión* → *Iniciar sesión* con **Google** → `sub` empieza con `google-oauth2|`.
- 💥 **Opcional:** cancelar el login o quitar temporalmente la Callback URL en Auth0 → se ve el mensaje de error.

## `parteB-paso06` · Probar API y comparar tokens

- **Abrir:** `src/components/ApiPanel.tsx`, `src/components/AccessTokenPanel.tsx`.
- **Explicar:**
  - `getAccessTokenSilently()`: devuelve el token de la caché o lo renueva sin interrumpir al usuario.
  - Comparar con el token de la Parte A: `alg` **RS256** + `kid` (vs HS256), `iss` = tenant de Auth0 (vs `http://localhost:5080`), `aud` = `https://api.demo-auth.local` (vs `auth-local-web`), `permissions`.
- **Probar en el navegador** (usuario **con** rol `Lector`):

| Botón | Resultado esperado |
|---|---|
| Público | **200** · mensaje público |
| Privado | **200** · `sub` y `permissions: ["read:messages"]` |
| Con permiso | **200** |

- 💥 **Usuario SIN el rol:** *Cerrar sesión* → entrar con el segundo usuario → panel del token: `"permissions": []` → botón *Con permiso* → **403**. *Privado* sigue dando **200** (autenticado, pero sin permiso).
- **requests.http:** botón *Copiar token* → pegarlo en `@token` (y el del usuario sin rol en `@tokenSinRol`) → ejecutar las peticiones: `200`, `200`, **`403`** con `tokenSinRol`, **`401`** sin token.

---

## Resumen de códigos de estado para la pizarra

| Código | Significado | Dónde lo vimos |
|---|---|---|
| 200 / 201 | OK / creado | login, perfil, registro |
| 400 | Datos inválidos | registro inválido, código 2FA incorrecto en `enable` |
| 401 | No autenticado (sin token, token inválido/expirado/modificado, credenciales incorrectas) | `/api/profile`, `/api/private`, login fallido |
| 403 | Autenticado, pero sin permiso | tempToken en `/api/profile`, usuario sin rol en `/api/private-scoped` |
| 409 | Conflicto | correo ya registrado, 2FA ya activo |
| 429 | Demasiadas peticiones | 6.º intento de login en un minuto |
