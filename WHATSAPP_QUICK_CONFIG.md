# ⚡ WhatsApp Business API - Guía Rápida (5 minutos)

## 🎯 Objetivo
Activar WhatsApp Business API de Meta en Isytask para:
- Enviar/recibir mensajes directamente desde Meta
- Fallback automático a Twilio si Meta falla
- Ahorrar ~65% en costos de mensajes

---

## ⏱️ Pasos (5 minutos)

### Paso 1: Obtener Credenciales (2 min)

1. Ve a https://business.facebook.com
2. Selecciona tu Business Account
3. Busca **"WhatsApp Business"**
4. Copia estos valores:

```
📱 Phone Number ID:        ________________
🏢 Business Account ID:     ________________
🔑 Access Token:            ________________
```

**Cómo obtener Access Token:**
- Ve a https://developers.facebook.com
- Tu App → Configuración → Tokens de Acceso
- Generar Token (elige todos los permisos whatsapp_*)
- Copia el token completo

### Paso 2: Generar Webhook Token (1 min)

Elige una contraseña fuerte aleatoria:

```bash
# Ejecuta en terminal para generar
openssl rand -hex 32
```

Resultado ejemplo:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t
```

Guarda este valor.

### Paso 3: Configurar en Isytask (2 min)

1. Inicia sesión: https://isytask-web.vercel.app
2. **Admin** → **Configuración** (scroll down)
3. Busca sección: **"WhatsApp Business API"**
4. Completa estos 5 campos:

| Campo | Valor |
|-------|-------|
| `meta_whatsapp_phone_number_id` | (del Paso 1) |
| `meta_whatsapp_business_account_id` | (del Paso 1) |
| `meta_whatsapp_access_token` | (del Paso 1) |
| `meta_whatsapp_webhook_token` | (del Paso 2) |
| `notification_whatsapp_business_enabled` | ✅ true |

5. **GUARDAR**

### Paso 4: Configurar Webhook en Meta (1 min)

1. Ve a https://developers.facebook.com
2. Tu App → **WhatsApp**
3. **Configuración** → **Webhooks**
4. Click **"Editar"**
5. Completa:
   - **Callback URL**: `https://isytask-web.vercel.app/api/webhooks/whatsapp-business`
   - **Verify Token**: El que creaste en Paso 2
6. Click **"Verificar y guardar"** ✅
7. En la sección **Webhook fields**, marca: ✅ `messages`
8. **Guardar cambios**

---

## ✅ ¡Listo!

Ahora:
- ✅ Mensajes se envían por Meta (más barato)
- ✅ Si Meta falla, usa automáticamente Twilio
- ✅ Recibes mensajes de ambos
- ✅ Todo funciona en paralelo

---

## 🧪 Prueba Rápida

Abre WhatsApp, envía un mensaje a tu número de negocio:

```
Hola, esto es una prueba
```

Debería aparecer en **Admin → WhatsApp** en 2-3 segundos.

---

## 🆘 Si algo no funciona

### Error: "Invalid signature"
- ✅ Verifica que `meta_whatsapp_webhook_token` en Isytask
- ✅ Coincida exactamente con el "Verify Token" en Meta

### No recibe mensajes
- ✅ Verifica que `notification_whatsapp_business_enabled` = **true**
- ✅ Verifica que el número esté **verificado** en Meta (24-48h)

### Access Token rechazado
- ✅ El token venció (>60 días)
- ✅ Genera uno nuevo en https://developers.facebook.com
- ✅ Asegúrate de tener permisos `whatsapp_*`

---

## 💰 Costos

| Proveedor | Precio | Primeros |
|-----------|--------|----------|
| **Meta** | $0.0035/msg | 1000/mes gratis |
| **Twilio** | $0.01/msg | $0.01/msg |
| **Ahorro** | **65%** | - |

---

## 📚 Documentación Completa

Para más detalles: Ver `WHATSAPP_BUSINESS_SETUP.md`

---

**¿Preguntas?** Revisa el documento largo o checkea los logs en Admin → Configuración.

**Status:** ✅ Ready to Go!
