# Guía de conexión del backend — Playbook CBP v2

Conecta la app a Supabase (base de datos + login) y publícala en Netlify.
Tiempo estimado: **20-30 min**. No necesitas saber programar, solo copiar y pegar.

> **Regla de oro de seguridad**
> La `anon key` (o `publishable key`) SÍ va en el código del navegador, es pública y está protegida por las reglas RLS de la base de datos.
> La **contraseña de la base de datos** y la **`service_role` / `secret key`** NUNCA se ponen en el código. No las pegues en `config.js`.

---

## PARTE A — Supabase (base de datos + autenticación)

### A1. Crear el proyecto

1. Entra en **https://supabase.com** y pulsa **Start your project** / **Sign in** (puedes entrar con GitHub o con email).
2. En el panel, pulsa **New project**.
3. Rellena:
   - **Name:** `playbook-cbp`
   - **Database Password:** genera una y **guárdala** en tu gestor de contraseñas (la necesitarás si algún día conectas por SQL externo; no va en la app).
   - **Region:** `West EU (Ireland)` o `Central EU (Frankfurt)` — el más cercano a España.
   - **Plan:** `Free`.
4. Pulsa **Create new project** y espera ~2 minutos a que se aprovisione (verás una barra de progreso).

### A2. Copiar las credenciales a `config.js`

1. Con el proyecto abierto, pulsa el botón **Connect** (arriba del todo, junto al nombre del proyecto)
   — o ve a **Project Settings** (icono de engranaje, abajo izquierda) → **API Keys**.
2. Apunta dos valores:
   - **Project URL** → algo como `https://abcdxyz.supabase.co`
   - **anon / public** (clave larga; en la UI nueva puede llamarse **Publishable key**, empieza por `sb_publishable_…`). **Cualquiera de las dos sirve.**
   - ⚠️ NO copies la `service_role` ni la `secret key`.
3. Abre **`js/config.js`** del proyecto y sustituye los marcadores:

   ```js
   export const SUPABASE_URL = 'https://abcdxyz.supabase.co';   // tu Project URL
   export const SUPABASE_ANON_KEY = 'sb_publishable_…';          // tu anon / publishable key
   ```

4. Guarda el archivo.

### A3. Crear las tablas (ejecutar la migración SQL)

1. En la barra lateral izquierda de Supabase, pulsa **SQL Editor**.
2. Pulsa **+ New query**.
3. Abre el archivo **`supabase/migrations/001_initial_schema.sql`** del proyecto, copia **todo** su contenido y pégalo en el editor.
4. Pulsa **Run** (o `Ctrl+Enter`). Debe poner *Success. No rows returned*.
5. Comprueba: barra lateral → **Table Editor**. Deberías ver 4 tablas:
   `profiles`, `teams`, `seasons`, `exercises`.
   En `teams` ya aparecen los 3 equipos; en `seasons`, la temporada `2025/26`.

### A4. Ajustar el login y el "recordar dispositivo"

Por defecto Supabase ya mantiene la sesión guardada en el navegador, así que "recordar dispositivo" funciona de fábrica. Solo conviene revisar que **no haya caducidad forzada**:

1. Barra lateral → **Authentication** → **Sessions** (o **Settings** según versión).
2. Asegúrate de que estén **vacíos / desactivados**:
   - **Time-box user sessions** (vacío = la sesión no caduca a la fuerza).
   - **Inactivity timeout** (vacío = no cierra sesión por inactividad).
3. Deja **Access Token (JWT) expiry** como está (`3600` s). El cliente lo renueva solo cada hora; no lo toques.

   > Esto da el efecto "recordar 6 meses": la sesión persiste mientras el entrenador vuelva a entrar de vez en cuando.

### A5. Cerrar el registro abierto (solo el admin crea entrenadores)

Según el plan, tú (admin) das de alta a cada entrenador. Para que nadie de fuera se registre:

1. **Authentication** → **Sign In / Providers** → **Email**.
2. **Desactiva** *Allow new users to sign up* (o *Enable email signup*).
3. Guarda.

### A6. Crear tu usuario administrador

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Email + contraseña tuyos. ✅ Marca **Auto Confirm User** (si no, no podrás entrar).
3. Pulsa **Create user**. (El sistema crea automáticamente su perfil como `coach`.)
4. Convertirte en `admin`: ve a **SQL Editor** → **New query**, pega esto con tu email y pulsa **Run**:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'TU_EMAIL_AQUI');
   ```

   Para dar de alta a otros entrenadores en el futuro: repite el paso A6 (1-3), se quedan como `coach` automáticamente.

---

## PARTE B — Netlify (publicar la app en internet)

### B1. Crear cuenta

1. Entra en **https://netlify.com** → **Sign up** (lo más cómodo: con GitHub).

### B2. Publicar — elige una opción

**Opción 1 — Arrastrar y soltar (la más rápida, sin Git):**

1. En Netlify, pulsa **Add new site** → **Deploy manually**.
2. Arrastra la carpeta **`cbp-v2`** entera a la zona de subida.
3. En segundos tendrás una URL tipo `https://random-name-123.netlify.app`.
   - ⚠️ Inconveniente: para actualizar la app tendrás que volver a arrastrar la carpeta.

**Opción 2 — Conectar con GitHub (recomendada, se actualiza sola):**

1. Sube la carpeta `cbp-v2` a un repositorio de GitHub.
2. En Netlify: **Add new site** → **Import an existing project** → **GitHub** → autoriza → elige el repo.
3. Configuración de build:
   - **Build command:** *(déjalo vacío, no hay build)*
   - **Publish directory:** `.` (si el repo es la carpeta `cbp-v2`) o `cbp-v2` (si subiste todo `D:\Claude Code`).
4. Pulsa **Deploy**.

> El archivo `netlify.toml` ya está configurado (carpeta de publicación, redirecciones y cabeceras de seguridad). No tienes que tocar nada.

### B3. Cambiar el nombre del sitio (opcional)

**Site configuration** → **Change site name** → pon `playbook-cbp` → la URL será `https://playbook-cbp.netlify.app`.

### B4. ⚠️ Paso crítico: decirle a Supabase cuál es tu dominio

Para que el login funcione desde Netlify (y no solo en local):

1. Vuelve a Supabase → **Authentication** → **URL Configuration**.
2. **Site URL:** pon tu URL de Netlify (`https://playbook-cbp.netlify.app`).
3. **Redirect URLs:** añade también `http://localhost:8139` (para pruebas locales) y la URL de Netlify.
4. Guarda.

---

### B5. Que la invitación llegue por correo

Cuando añades un correo en `/admin`, a esa persona le llega un enlace para poner su
contraseña. Eso lo hace `netlify/functions/invitar.mjs`, y necesita tres cosas.

**1 · La clave de servicio, en Netlify (no en el código)**

En Netlify: **Site configuration** → **Environment variables** → **Add a variable**.

| Variable | De dónde sale |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → *Project URL* |
| `SUPABASE_SERVICE_ROLE` | Supabase → Settings → API → *service_role* (la secreta) |

> ⚠️ Esa clave se salta todas las reglas de seguridad de la base. **Solo** va aquí,
> nunca en `config.js` ni en ningún fichero del repositorio. Si alguna vez se
> escapa, se rota desde el mismo sitio.

Si ya configuraste los avisos push, estas dos variables ya están puestas.

**2 · La dirección de vuelta, en la lista blanca**

En Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**, añade:

```
https://playbook-cbp.netlify.app/clave.html
```

Sin esto Supabase se niega a mandar el correo, y la app lo dirá con esas palabras:
*«la dirección de vuelta no está en la lista blanca»*.

**3 · Un servidor de correo de verdad**

Supabase trae uno incluido, pero **es para probar**: limita los correos por hora y no
garantiza la entrega. Para un club con veinte personas puede bastar al principio; si
ves que los correos no llegan o tardan, configura uno propio en
**Authentication** → **Emails** → **SMTP Settings** (Resend, Brevo y SendGrid tienen
plan gratuito suficiente).

En **Authentication** → **Emails** → **Templates** → *Invite user* puedes cambiar el
texto del correo. El enlace lo pone Supabase; no lo toques.

**Cómo saber si funcionó.** Al pulsar *Invitar* la app dice una de estas cuatro cosas,
y cada una pide algo distinto:

| Lo que dice | Qué ha pasado |
|---|---|
| «Invitación mandada a…» | Todo bien, no hay que hacer nada más |
| «…pero el correo no ha salido (motivo)» | La invitación **vale igual**: avisa tú a esa persona, que entre con *«Tengo invitación y es mi primera vez»* |
| «…ya tiene cuenta» | No hacía falta invitarla; que entre directamente |
| «Solo el administrador puede invitar» | Estás con una cuenta de entrenador |

En local (`python serve.py`) no hay funciones de Netlify, así que siempre saldrá el
segundo mensaje: la invitación se guarda pero el correo no sale. Es lo esperado.

---

## PARTE C — Comprobar que todo funciona (hito de Fase 1)

Abre tu URL de Netlify en el móvil o el navegador y verifica que puedes:

1. **Entrar** con tu email + contraseña de admin.
2. **Crear un ejercicio** (botón *Nuevo ejercicio*): nombre + categoría + descripción → *Guardar*.
3. **Verlo** en la lista de ejercicios.
4. **Cerrar sesión** y **volver a entrar**: el ejercicio sigue ahí.

Si esos 4 pasos funcionan, **la Fase 1 está terminada** ✅.

---

## Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Invalid login credentials" al entrar | Usuario sin confirmar | Repite A6 marcando **Auto Confirm User** |
| La página carga pero no entra / consola con error de red | `config.js` con URL o key mal pegada | Revisa A2, sin espacios ni comillas de más |
| Entras pero la lista de ejercicios da error | Migración SQL no ejecutada | Repite A3 y comprueba las 4 tablas |
| "row level security" al crear ejercicio | Tu perfil no es admin / no hay sesión | Repite A6 paso 4 (poner `role = 'admin'`) |
| Login funciona en local pero no en Netlify | Falta el dominio en Supabase | Repite B4 (URL Configuration) |

---

*Cuando termines, avísame y seguimos con la siguiente fase. La integración de IA (Netlify Functions + Claude Haiku) y el editor visual llegan más adelante; no hacen falta para que la Fase 1 funcione.*
