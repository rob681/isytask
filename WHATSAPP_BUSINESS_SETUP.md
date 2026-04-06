# WhatsApp Business API Integration Setup

Guía completa para configurar WhatsApp Business API (Meta) en Isytask.

## 📋 Prerequisites

- **Meta Business Account** (gratuita)
- **WhatsApp Business Account** configurada en Meta
- **Access Token** de Meta/Facebook
- **Números verificados** en WhatsApp Business Account
- Acceso a admin de Isytask

---

## 🔧 Pasos de Configuración

### 1️⃣ Obtener Credenciales de Meta

#### Opción A: Usando Meta Business Manager (Recomendado)

1. Ir a [business.facebook.com](https://business.facebook.com)
2. Seleccionar tu Business Account
3. Ir a **Configuración** → **WhatsApp Business Account**
4. Click en tu cuenta de WhatsApp Business
5. En la sección **API Setup**, encontrarás:
   - **Phone Number ID**: Ej. `1234567890`
   - **Business Account ID**: Ej. `5678901234`

#### Opción B: Vía Graph API

```bash
# Reemplaza {user-access-token} con tu token
curl "https://graph.instagram.com/v18.0/me/whatsapp_business_accounts?fields=id,name&access_token={user-access-token}"
```

### 2️⃣ Generar Access Token

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear una **App** si no tienes una
3. Agregar producto **WhatsApp**
4. Ir a **Configuración** → **Autenticación** → **Tokens de Acceso**
5. Generar token con estos permisos:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`

⚠️ **Importante**: Guarda el token en un lugar seguro. No lo compartirás con nadie.

### 3️⃣ Obtener Phone Number ID

1. En Meta Business Manager, ir a tu WhatsApp Business Account
2. Ir a **Números de Teléfono**
3. Click en tu número verificado
4. Copiar el **ID del Número de Teléfono** (Phone Number ID)

Ejemplo: `102345678901234`

### 4️⃣ Crear Webhook Verification Token

Este es un token que **TÚ DECIDES** (no viene de Meta):

```bash
# Generar un token seguro
openssl rand -hex 32
# Resultado ejemplo: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

Guarda este token, lo necesitarás después.

### 5️⃣ Configurar en Isytask Admin

1. **Inicia sesión** como Admin en https://isytask-web.vercel.app
2. Ve a **Admin** → **Configuración**
3. Busca la sección **"WhatsApp Business API"**
4. Completa los siguientes campos:

| Campo | Valor | Ejemplo |
|-------|-------|---------|
| **meta_whatsapp_phone_number_id** | Tu Phone Number ID | `102345678901234` |
| **meta_whatsapp_business_account_id** | Tu Business Account ID | `5678901234` |
| **meta_whatsapp_access_token** | Tu Meta Access Token | `EAABa...` |
| **meta_whatsapp_webhook_token** | Token que creaste (paso 4) | `a1b2c3d4...` |
| **notification_whatsapp_business_enabled** | `true` | ✅ |

5. **Guarda los cambios**

### 6️⃣ Configurar Webhook en Meta

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Seleccionar tu **App**
3. Ir a **WhatsApp** → **Configuración**
4. En la sección **Webhooks**, click en **Editar**
5. Rellenar:
   - **Callback URL**: `https://isytask-web.vercel.app/api/webhooks/whatsapp-business`
   - **Verify Token**: El token que creaste en el paso 4
6. Click en **Verificar y guardar**

Meta hará una llamada GET a tu webhook para verificar. Debería responder con un ✅ **200 OK**.

### 7️⃣ Suscribir a Eventos

En la **Configuración de Webhooks** de Meta:

1. En la sección **Webhook fields**, selecciona:
   - ✅ `messages` (Mensajes inbound)
   - ✅ `message_template_status_update` (Estado de templates)
   - ✅ `message_status` (Confirmación de entrega)

2. Click en **Guardar cambios**

---

## ✅ Verificación

Después de configurar, verifica que todo funciona:

### Test 1: Enviar mensaje de prueba

```bash
# Desde terminal (reemplaza valores)
curl -X POST "https://graph.instagram.com/v18.0/{phone_number_id}/messages" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "{recipient_phone}",
    "type": "text",
    "text": {
      "body": "¡Hola! Esto es una prueba desde Isytask"
    }
  }'
```

### Test 2: Recibir mensaje

Envía un mensaje a tu número de WhatsApp desde otro número. Debería:
1. Llegar a la base de datos de Isytask
2. Aparecer en la lista de contactos
3. Intentar hacer match automático con una tarea

---

## 🔄 Migración de Twilio → WhatsApp Business API

### Si usas Twilio actualmente:

**NO necesitas cambiar nada en el código.** Isytask ahora soporta **ambos**.

#### Opción 1: Usar solo Meta (recomendado para nuevo setup)

1. En Admin → Configuración:
   - Desactiva: `notification_whatsapp_enabled` → `false`
   - Activa: `notification_whatsapp_business_enabled` → `true`

2. Configurate **solo Meta** en los campos Meta

#### Opción 2: Usar ambos en paralelo (recomendado para transición)

1. Mantén Twilio configurado y activo
2. Además, configura Meta
3. Isytask intentará usar Meta primero, fallback a Twilio

Para cambiar prioridad:
```
En Admin → Configuración → whatsapp_primary_provider:
- Valor: "meta" (usa Meta primero)
- Valor: "twilio" (usa Twilio primero, default)
```

---

## 🚀 Casos de Uso

### Enviar notificación cuando una tarea se asigna:

```typescript
// El código de Isytask hace esto automáticamente
await sendWhatsAppMessageHybrid({
  db,
  to: "+521234567890",
  body: "📋 Nueva tarea: 'Diseñar logo'. Vence: mañana",
  provider: "auto", // Usa el provider configurado
});
```

### Recibir mensaje y crear comentario automático:

```
1. Cliente envía mensaje al número de WhatsApp
2. Meta webhook recibe el mensaje
3. Isytask crea un TaskComment automáticamente
4. Admin ve el nuevo comentario en la tarea
```

---

## 🐛 Troubleshooting

### Problema: "Invalid signature" en webhook

**Solución**:
- Verifica que `meta_whatsapp_webhook_token` en Isytask
- Coincida exactamente con el "Verify Token" en Meta
- No hay espacios ni caracteres extra

### Problema: Mensajes no se reciben

**Solución**:
1. Verifica que en Meta el webhook esté **Verificado** ✅
2. Verifica que `notification_whatsapp_business_enabled` = `true`
3. Verifica que el `phone_number_id` sea correcto
4. Comprueba en Meta → Webhooks → Logs que los eventos llegan

### Problema: "Phone Number Not Registered"

**Solución**:
- El número debe estar **verificado** en WhatsApp Business
- Debe estar en estado **Active** (no pendiente)
- Espera 24-48 horas después de verificar si es nuevo

### Problema: Envío falla silenciosamente

**Solución**:
- Revisa los logs de Isytask: `console.error("[WhatsApp Business]"...)`
- Verifica que `meta_whatsapp_access_token` sea válido
- El token expira después de 60 días, necesita renovarse

---

## 📚 Links Útiles

- [Meta WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Webhook Events Reference](https://developers.facebook.com/docs/whatsapp/webhooks/components)
- [Business Manager](https://business.facebook.com/)
- [Meta Developers Console](https://developers.facebook.com/)

---

## ❓ Preguntas Frecuentes

**P: ¿Cuánto cuesta WhatsApp Business API?**
A: Meta cobra por mensaje. Primeros 1000 mensajes al mes son gratis de negocio → cliente. Después ~$0.0035/mensaje. Más info: [Pricing](https://www.whatsapp.com/business/pricing/)

**P: ¿Puedo enviar mensajes sin notificación previa?**
A: No. Necesitas "Message Templates" aprobados para enviar inicialmente. Después el cliente puede responder libremente.

**P: ¿Cuál es la diferencia con Twilio?**
A:
- **Meta**: Más barato, integración nativa, mejor para notificaciones
- **Twilio**: Más features, mejor para chatbots complejos

**P: ¿Puedo cambiar entre Twilio y Meta?**
A: Sí. Isytask soporta ambos. Configura en Admin → whatsapp_primary_provider

---

## ✨ Tips Avanzados

### Template Messages (Optional)

Para mensajes con formato predefinido:

```bash
# Crear template en Meta
curl -X POST "https://graph.instagram.com/v18.0/{business_account_id}/message_templates" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "task_assigned",
    "language": "es_MX",
    "category": "TRANSACTIONAL",
    "components": [{
      "type": "body",
      "text": "Hola {{1}}, se te asignó la tarea: {{2}}"
    }]
  }'
```

### Media Messages

Enviar imágenes o documentos:

```typescript
await sendWhatsAppBusinessMessage({
  db,
  to: "+521234567890",
  body: "Ver adjunto",
  mediaUrl: "https://example.com/image.jpg",
  mediaType: "image",
});
```

---

**Última actualización:** 2026-03-21
**Versión:** 1.0
**Estado:** ✅ Production Ready
