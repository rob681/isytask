/**
 * Isyweb Brochure — field schema and AI prompt builders.
 *
 * The brochure is the briefing the client fills before development starts.
 * It can be filled with AI assistance (conversational) or manually (form).
 */

export const BROCHURE_FIELD_DEFS = [
  // ── Business / context ──
  { key: "business_name", label: "Nombre del negocio o marca", type: "text", required: true },
  { key: "business_description", label: "¿A qué se dedica?", type: "textarea", required: true },
  { key: "target_audience", label: "Público objetivo", type: "textarea", required: true },
  { key: "value_proposition", label: "Propuesta de valor / qué los hace únicos", type: "textarea", required: false },

  // ── Site structure ──
  { key: "site_type", label: "Tipo de sitio", type: "select", required: true,
    options: ["LANDING", "ONE_PAGE", "MULTI_PAGE", "ECOMMERCE", "WEBAPP", "BLOG", "OTHER"] },
  { key: "pages", label: "Páginas / pestañas que llevará el sitio", type: "page_list", required: true },

  // ── Visual identity ──
  { key: "primary_color", label: "Color principal", type: "color", required: false },
  { key: "secondary_color", label: "Color secundario", type: "color", required: false },
  { key: "style_keywords", label: "Estilo / personalidad (3-5 adjetivos)", type: "tags", required: false },
  { key: "references", label: "Sitios web de referencia (URLs que te gustan)", type: "url_list", required: false },

  // ── Content ──
  { key: "key_messages", label: "Mensajes clave que debe transmitir", type: "textarea", required: false },
  { key: "cta_primary", label: "Acción principal (CTA): qué quieres que haga el visitante", type: "text", required: true },

  // ── Conditional (E-commerce) ──
  { key: "products_count", label: "Cantidad aproximada de productos", type: "number", required: false, dependsOn: { site_type: "ECOMMERCE" } },
  { key: "payment_methods", label: "Métodos de pago aceptados", type: "tags", required: false, dependsOn: { site_type: "ECOMMERCE" } },

  // ── Other ──
  { key: "must_have_features", label: "Funcionalidades imprescindibles", type: "textarea", required: false },
  { key: "domain", label: "Dominio (si ya lo tienes)", type: "url", required: false },
] as const;

export type BrochureFieldDef = (typeof BROCHURE_FIELD_DEFS)[number];

export const MAX_AI_QUESTIONS = 12;

// ── AI System Prompt ──

export function buildBrochureSystemPrompt(filledState: Record<string, any>): string {
  const fieldsDescription = BROCHURE_FIELD_DEFS.map((f) => {
    let desc = `- "${f.key}" (${f.label}, tipo: ${f.type}`;
    if (f.required) desc += ", REQUERIDO";
    if ("options" in f && f.options) desc += `, opciones: [${f.options.join(", ")}]`;
    if ("dependsOn" in f && f.dependsOn) {
      const [k, v] = Object.entries(f.dependsOn)[0];
      desc += `, solo si ${k}="${v}"`;
    }
    desc += ")";
    return desc;
  }).join("\n");

  const filled = Object.entries(filledState)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join("\n");

  return `Eres un asistente que ayuda a un cliente de una agencia digital a definir su sitio web. Tu trabajo es entrevistarlo de forma amigable y eficiente para llenar un brochure de proyecto.

## Campos que debes recolectar
${fieldsDescription}

## Estado actual (ya completado)
${filled || "(vacío)"}

## Reglas
1. Habla en español, tono cálido y profesional. Usa "tú" no "usted".
2. Una pregunta a la vez. Cortas. Sin preámbulos largos.
3. Cuando el usuario responda, EXTRAE los datos a los campos correspondientes.
4. Si una respuesta llena varios campos, llénalos todos.
5. Si el usuario es vago, pide aclaración con un ejemplo concreto.
6. NUNCA preguntes algo que ya esté en el "Estado actual".
7. Si site_type no es ECOMMERCE, NO preguntes products_count ni payment_methods.
8. Salta los campos no requeridos si el usuario ya dio mucha info.
9. Cuando tengas todos los campos REQUERIDOS llenos, marca done=true.

## Formato de respuesta
SIEMPRE responde con un JSON válido y nada más:
{
  "next_question": "tu siguiente pregunta o null si terminaste",
  "extracted_fields": [
    { "key": "business_name", "value": "Cafetería Luna" },
    { "key": "site_type", "value": "MULTI_PAGE" }
  ],
  "done": false,
  "summary_for_user": "breve nota amigable que se mostrará al cliente, ej. 'Genial — anoté que tu negocio es...' (máx 1 oración, opcional)"
}

Si done=true, next_question=null y agrega un summary_for_user que felicite al cliente por terminar.`;
}

// ── Initial greeting ──

export const BROCHURE_INITIAL_QUESTION =
  "¡Hola! Soy tu asistente para definir tu sitio web 🌐 Voy a hacerte unas preguntas para entender qué necesitas. Empecemos por lo básico — ¿cómo se llama tu negocio o marca y a qué se dedica?";
