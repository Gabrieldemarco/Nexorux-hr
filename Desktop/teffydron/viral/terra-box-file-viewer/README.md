# TeraBox File Viewer

Una aplicación Next.js para navegar y compartir archivos de TeraBox mediante códigos QR. Ideal para gestionar videotecas y bibliotecas de archivos almacenados en TeraBox.

## Características

- 📁 Navegación de carpetas de TeraBox
- 🎬 Visualización de videos y archivos
- 📱 Generación de códigos QR para compartir carpetas y videos
- 🔐 Sistema de autenticación con email/contraseña
- 👤 Perfiles de usuario
- 💬 Comunidad con posts, comentarios y likes
- 🎨 UI moderna con shadcn/ui y Tailwind CSS

## Stack Tecnológico

- **Framework**: Next.js 16.4.3
- **Lenguaje**: TypeScript
- **Base de datos**: PostgreSQL con Drizzle ORM
- **Autenticación**: better-auth
- **UI**: shadcn/ui, Tailwind CSS v4
- **Icons**: Lucide React
- **Package Manager**: pnpm

## Requisitos Previos

- Node.js 18+ instalado
- pnpm instalado (`npm install -g pnpm`)
- Base de datos PostgreSQL (local o en la nube)
- Cuenta de TeraBox

## Instalación

1. Clona el repositorio:
```bash
git clone <tu-repositorio>
cd terra-box-file-viewer
```

2. Instala las dependencias:
```bash
pnpm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/terabox_viewer"
TERABOX_NDUS="tu_cookie_ndus_aqui"
BETTER_AUTH_URL="http://localhost:3000"
```

### Obtener la cookie de TeraBox

1. Inicia sesión en [https://www.terabox.com](https://www.terabox.com)
2. Abre las DevTools del navegador (F12)
3. Ve a Application > Cookies > https://www.terabox.com
4. Encuentra la cookie `ndus` y copia su valor
5. Pega el valor en `TERABOX_NDUS` (con o sin el prefijo `ndus=`)

## Configuración de la Base de Datos

1. Crea la base de datos PostgreSQL:
```sql
CREATE DATABASE terabox_viewer;
```

2. Genera las migraciones:
```bash
pnpm db:generate
```

3. Ejecuta las migraciones:
```bash
pnpm db:migrate
```

O si prefieres usar `push` (para desarrollo):
```bash
pnpm db:push
```

## Scripts Disponibles

```bash
# Desarrollo
pnpm dev              # Inicia el servidor de desarrollo en http://localhost:3000

# Producción
pnpm build            # Construye la aplicación para producción
pnpm start            # Inicia el servidor de producción

# Base de datos
pnpm db:generate      # Genera migraciones desde el schema
pnpm db:migrate       # Ejecuta las migraciones pendientes
pnpm db:push          # Envía el schema directamente a la BD (dev)
pnpm db:studio        # Abre Drizzle Studio para visualizar la BD
```

## Estructura del Proyecto

```
├── app/                    # Páginas y rutas de Next.js
│   ├── actions/           # Server actions
│   ├── api/               # API routes
│   ├── comunidad/         # Página de comunidad
│   ├── contacto/          # Página de contacto
│   ├── ingresar/          # Página de login
│   ├── perfil/            # Página de perfil
│   ├── registro/          # Página de registro
│   ├── u/                 # Rutas de usuario
│   ├── v/                 # Rutas de videos
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Página principal
├── components/            # Componentes React
│   ├── auth-form.tsx      # Formulario de autenticación
│   ├── file-browser.tsx   # Navegador de archivos
│   ├── qr-generator.tsx   # Generador de QR
│   └── ui/                # Componentes shadcn/ui
├── lib/                   # Utilidades y configuración
│   ├── db/                # Configuración de Drizzle
│   │   ├── schema.ts      # Schema de la base de datos
│   │   └── index.ts       # Conexión a la BD
│   ├── auth.ts            # Configuración de better-auth
│   ├── terabox.ts         # Cliente de TeraBox
│   └── utils.ts           # Utilidades generales
├── public/                # Archivos estáticos
└── drizzle/               # Migraciones de Drizzle
```

## Schema de la Base de Datos

El proyecto incluye las siguientes tablas:

- **user**: Usuarios del sistema
- **session**: Sesiones de autenticación
- **account**: Cuentas de autenticación
- **verification**: Tokens de verificación
- **profile**: Perfiles de usuario extendidos
- **post**: Posts de la comunidad
- **comment**: Comentarios de posts
- **post_like**: Likes de posts

## Despliegue

### Vercel

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en Vercel:
   - `DATABASE_URL`
   - `TERABOX_NDUS`
   - `BETTER_AUTH_URL` (tu dominio de producción)
3. Deploy automático al hacer push a main

### Otros proveedores

Asegúrate de configurar:
- Variables de entorno
- Base de datos PostgreSQL accesible
- URL base para autenticación

## Solución de Problemas

### Error: "Falta la variable de entorno TERABOX_NDUS"
Asegúrate de configurar `TERABOX_NDUS` en tu archivo `.env.local`.

### Error: "Tu sesión de TeraBox expiró"
La cookie de TeraBox expira periódicamente. Necesitas obtener una nueva cookie y actualizar `TERABOX_NDUS`.

### Error de conexión a la base de datos
Verifica que:
- `DATABASE_URL` sea correcta
- La base de datos exista
- Las credenciales sean válidas
- PostgreSQL esté corriendo

### Errores de TypeScript en build
El proyecto tiene `ignoreBuildErrors: true` en `next.config.mjs`. Para producción, corrige los errores de TypeScript antes de construir.

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto es privado.

## Soporte

Para reportar issues o solicitar features, abre un issue en el repositorio.

---

Generado con [Devin](https://devin.ai)
