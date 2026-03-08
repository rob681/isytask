# Isytask — Guía de Deploy a Producción

## Pre-requisitos

- Cuenta de [Vercel](https://vercel.com)
- Base de datos PostgreSQL (Supabase recomendado)
- Repositorio en GitHub/GitLab/Bitbucket

---

## 1. Variables de Entorno en Vercel

En tu proyecto de Vercel → Settings → Environment Variables, configura:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres` | URL de conexión a PostgreSQL |
| `NEXTAUTH_URL` | `https://tu-dominio.com` | URL pública del sitio |
| `NEXTAUTH_SECRET` | *(generar)* | Secreto JWT para sesiones |
| `CRON_SECRET` | *(generar)* | Secreto para autenticar cron jobs |

### Generar secretos seguros

```bash
# NEXTAUTH_SECRET (32 bytes base64)
openssl rand -base64 32

# CRON_SECRET (16 bytes hex)
openssl rand -hex 16
```

> ⚠️ **IMPORTANTE:** `NEXTAUTH_URL` debe ser la URL exacta de tu dominio en producción, incluyendo `https://`. Sin esto, el login no funcionará.

---

## 2. Configurar Vercel

### Importar proyecto

1. En Vercel → "Add New Project"
2. Importa tu repositorio
3. Framework: **Next.js** (auto-detectado)
4. Root Directory: **`apps/web`**
5. Build Command: `cd ../.. && pnpm build` (o deja el default, vercel.json lo configura)
6. Agrega las variables de entorno del paso 1

### Verificar vercel.json

El archivo `vercel.json` ya configura:
- Build command: `pnpm build`
- Cron jobs (tareas recurrentes, recordatorios, alertas SLA)

---

## 3. Base de Datos

### Opción A: Usar Supabase existente (desarrollo)

Si ya tienes datos de prueba, puedes usar la misma DB. Solo asegúrate de que el `DATABASE_URL` en Vercel apunte a ella.

### Opción B: Nueva base de datos para producción (recomendado)

1. Crea un nuevo proyecto en [Supabase](https://supabase.com)
2. Copia el connection string de Settings → Database → Connection string (URI)
3. Configura `DATABASE_URL` en Vercel con ese string

### Sincronizar esquema

```bash
# Desde tu máquina local, apuntando a la DB de producción:
DATABASE_URL="postgresql://..." pnpm db:push
```

### Crear admin inicial

```bash
# Opción 1: Con argumentos
DATABASE_URL="postgresql://..." pnpm db:init -- --email admin@tuempresa.com --password MiPasswordSeguro123!

# Opción 2: Con variables de entorno
DATABASE_URL="postgresql://..." ADMIN_EMAIL=admin@tuempresa.com ADMIN_PASSWORD=MiPasswordSeguro123! pnpm db:init
```

> ⚠️ **NO uses `db:seed` en producción.** El seed crea datos de demostración con contraseñas débiles. Usa `db:init` para crear solo el admin.

---

## 4. Dominio Personalizado (Opcional)

1. En Vercel → Settings → Domains
2. Agrega tu dominio (ej: `app.tuempresa.com`)
3. Configura los registros DNS según las instrucciones de Vercel
4. **Actualiza `NEXTAUTH_URL`** en las variables de entorno con el nuevo dominio

---

## 5. Post-Deploy

### Primera configuración

1. Inicia sesión con el admin creado en el paso 3
2. Ve a **Configuración** para personalizar:
   - Nombre de la empresa
   - Logo
   - Zona horaria
   - Configuración de notificaciones (Resend API key, etc.)
3. Crea **Servicios** con sus formularios dinámicos
4. Invita **Colaboradores** y **Clientes**

### Verificar cron jobs

Los cron jobs se ejecutan automáticamente en Vercel:
- **Tareas recurrentes:** cada hora
- **Recordatorios:** cada 6 horas
- **Alertas SLA:** cada hora

Verifica en Vercel → Settings → Cron Jobs que estén activos.

---

## 6. Checklist Final

- [ ] Variables de entorno configuradas en Vercel
- [ ] `NEXTAUTH_SECRET` generado con `openssl rand -base64 32`
- [ ] `CRON_SECRET` generado con `openssl rand -hex 16`
- [ ] `NEXTAUTH_URL` apunta al dominio correcto con `https://`
- [ ] Esquema de DB sincronizado (`db:push`)
- [ ] Admin inicial creado (`db:init`)
- [ ] Primer login exitoso
- [ ] Configuración de empresa completada
- [ ] Al menos un servicio creado
- [ ] Cron jobs funcionando (verificar en Vercel dashboard)

---

## Solución de Problemas

### El login no funciona
- Verifica que `NEXTAUTH_URL` sea exactamente tu dominio con `https://`
- Verifica que `NEXTAUTH_SECRET` esté configurado
- Revisa los logs en Vercel → Deployments → Functions

### Los cron jobs no se ejecutan
- Verifica que `CRON_SECRET` esté configurado en Vercel
- Los cron jobs solo funcionan en el plan Pro de Vercel o superior
- En el plan Hobby, puedes usar un servicio externo (cron-job.org) que llame a tus endpoints con el header `Authorization: Bearer <CRON_SECRET>`

### Error de base de datos
- Verifica que `DATABASE_URL` sea correcto y accesible desde Vercel
- En Supabase, verifica que el pooler esté habilitado si tienes problemas de conexión
- Ejecuta `db:push` para sincronizar el esquema
