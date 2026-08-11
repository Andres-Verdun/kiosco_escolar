# Configurar el login con Google — paso a paso

Tu proyecto de Supabase es `lfksbqohhpyvunkmhtge`, así que la URL de callback
que vas a usar siempre es:

```
https://lfksbqohhpyvunkmhtge.supabase.co/auth/v1/callback
```

Guardala, la vas a pegar en Google Cloud Console.

## 1. Subir la página a Vercel

Si todavía no la subiste: creá un proyecto en [vercel.com](https://vercel.com),
importá esta carpeta (o conectala a tu repo de GitHub) y desplegala. Vercel te
va a dar una URL fija, algo como:

```
https://kiosco-escolar.vercel.app
```

Vas a necesitar esa URL exacta en los pasos 2 y 3. Si usás un dominio propio
más adelante, repetí los pasos 2 y 3 agregando también ese dominio.

## 2. Crear las credenciales de Google

1. Andá a [console.cloud.google.com](https://console.cloud.google.com/) →
   creá un proyecto nuevo (o usá uno existente).
2. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**.
   - Completá nombre de la app ("Kiosco Escolar"), tu email de soporte, etc.
   - Dejala en estado **Testing/Pruebas** (no hace falta publicarla ni pedirle
     verificación a Google para 5 usuarios).
   - En la sección **Usuarios de prueba**, agregá los 5 emails de Gmail que
     van a poder entrar. Esto es una segunda barrera: si un email no está acá,
     Google ni siquiera deja completar el login, sin depender de tu app.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - Orígenes de JavaScript autorizados: tu URL de Vercel, ej.
     `https://kiosco-escolar.vercel.app`
   - URIs de redirección autorizados:
     `https://lfksbqohhpyvunkmhtge.supabase.co/auth/v1/callback`
   - Creá y copiá el **Client ID** y el **Client secret**.

## 3. Conectar Google a Supabase

1. En el dashboard de Supabase → **Authentication → Providers → Google**:
   activalo y pegá el Client ID y el Client secret del paso anterior. Guardar.
2. **Authentication → URL Configuration**:
   - Site URL: tu URL de Vercel (`https://kiosco-escolar.vercel.app`).
   - Redirect URLs: agregá esa misma URL a la lista.

## 4. Aplicar la seguridad en la base de datos

1. En Supabase → **SQL Editor → New query**, pegá el contenido del archivo
   `supabase-rls.sql` (está en esta misma carpeta) y ejecutalo. Esto crea la
   tabla `autorizados` y bloquea `kiosco_datos` para que solo usuarios
   logueados y autorizados puedan leer o escribir.
2. En **Table Editor → autorizados → Insert row**, cargá los 5 emails
   (los mismos que agregaste como "usuarios de prueba" en Google). Para dar
   de baja a alguien más adelante, alcanza con borrar su fila ahí — no hace
   falta tocar código ni volver a desplegar nada.

## 5. Probar

1. Abrí la URL de Vercel. Debería aparecer la pantalla de login.
2. Iniciá sesión con uno de los 5 emails autorizados → tiene que llevarte
   directo a la selección de turno.
3. Probá con una cuenta de Google que **no** esté en la lista → tiene que
   mostrar la pantalla "Sin autorización" (o directamente Google va a
   rechazar el login si no la agregaste como usuario de prueba).
4. Con las herramientas de desarrollador del navegador podés confirmar que,
   sin sesión iniciada, las consultas a `kiosco_datos` devuelven vacío/],
   no los datos reales.
