import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../trpc";
import { chatCompletion } from "../lib/openrouter";
import { getAgencyId } from "../trpc";

const AGENCY_TYPES = [
  "marketing_digital",
  "diseno_grafico",
  "desarrollo_web",
  "publicidad",
  "redes_sociales",
  "consultoria",
  "fotografia_video",
  "branding",
  "ecommerce",
  "otro",
] as const;

const AGENCY_TYPE_LABELS: Record<string, string> = {
  marketing_digital: "Marketing Digital",
  diseno_grafico: "Diseño Gráfico",
  desarrollo_web: "Desarrollo Web / Software",
  publicidad: "Publicidad y Medios",
  redes_sociales: "Redes Sociales / Community Management",
  consultoria: "Consultoría Empresarial",
  fotografia_video: "Fotografía y Video",
  branding: "Branding e Identidad Visual",
  ecommerce: "E-commerce",
  otro: "Otro",
};

interface SuggestedService {
  name: string;
  description: string;
  estimatedHours: number;
  slaHours: number | null;
  fields: Array<{
    fieldName: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    placeholder?: string;
    options?: string[];
  }>;
}

export const onboardingRouter = router({
  /** Get available agency types for onboarding */
  getAgencyTypes: adminProcedure.query(() => {
    return AGENCY_TYPES.map((type) => ({
      value: type,
      label: AGENCY_TYPE_LABELS[type] || type,
    }));
  }),

  /** Check if agency has completed onboarding (has at least 1 service) */
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const agencyId = getAgencyId(ctx);
    const serviceCount = await ctx.db.service.count({
      where: { agencyId },
    });
    return {
      completed: serviceCount > 0,
      serviceCount,
    };
  }),

  /** AI-powered: suggest services based on agency type and description */
  suggestServices: adminProcedure
    .input(
      z.object({
        agencyType: z.string(),
        agencyDescription: z.string().max(500).optional(),
        teamSize: z.number().int().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const typeLabel = AGENCY_TYPE_LABELS[input.agencyType] || input.agencyType;

      const systemPrompt = `Eres un experto en gestión de agencias y automatización de flujos de trabajo.
Tu tarea es sugerir servicios que una agencia del tipo "${typeLabel}" ofrecería a sus clientes.

REGLAS:
- Sugiere entre 3 y 6 servicios relevantes para este tipo de agencia
- Cada servicio debe tener campos de formulario prácticos que el cliente llenaría al solicitar ese servicio
- Los campos deben ser concretos y útiles (no genéricos)
- Usa fieldType válidos: TEXT, TEXTAREA, NUMBER, SELECT, MULTISELECT, CHECKBOX, COLOR_PICKER, FILE, DATE, URL
- Para SELECT/MULTISELECT incluye opciones relevantes
- Responde ÚNICAMENTE con JSON válido, sin markdown ni explicaciones
- Usa español para todo (nombres, labels, opciones, placeholders)
- estimatedHours: tiempo típico en horas para completar el servicio
- slaHours: horas máximas de entrega (null si no aplica)

FORMATO JSON esperado:
{
  "services": [
    {
      "name": "Nombre del Servicio",
      "description": "Descripción corta del servicio",
      "estimatedHours": 4,
      "slaHours": 48,
      "fields": [
        {
          "fieldName": "campo_snake_case",
          "label": "Etiqueta visible",
          "fieldType": "TEXT",
          "isRequired": true,
          "placeholder": "Ejemplo de valor"
        }
      ]
    }
  ]
}`;

      const userMessage = `Tipo de agencia: ${typeLabel}${
        input.agencyDescription
          ? `\nDescripción adicional: ${input.agencyDescription}`
          : ""
      }${
        input.teamSize
          ? `\nTamaño del equipo: ${input.teamSize} personas`
          : ""
      }

Sugiere los servicios más importantes para esta agencia.`;

      const result = await chatCompletion({
        db: ctx.db,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        maxTokens: 3000,
        temperature: 0.6,
      });

      if (!result) {
        // Fallback: return predefined services based on agency type
        return { services: getDefaultServices(input.agencyType) };
      }

      try {
        // Extract JSON from response (handles markdown wrapping)
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return { services: getDefaultServices(input.agencyType) };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const services: SuggestedService[] = (parsed.services || []).slice(0, 6);

        return { services };
      } catch {
        return { services: getDefaultServices(input.agencyType) };
      }
    }),

  /** Create services from onboarding suggestions */
  createServices: adminProcedure
    .input(
      z.object({
        services: z.array(
          z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            estimatedHours: z.number().min(0.5).default(2),
            slaHours: z.number().nullable().optional(),
            fields: z
              .array(
                z.object({
                  fieldName: z.string(),
                  label: z.string(),
                  fieldType: z.string(),
                  isRequired: z.boolean(),
                  placeholder: z.string().optional(),
                  options: z.array(z.string()).optional(),
                })
              )
              .optional()
              .default([]),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agencyId = getAgencyId(ctx);
      const created: string[] = [];

      for (const svc of input.services) {
        const service = await ctx.db.service.create({
          data: {
            agencyId,
            name: svc.name,
            description: svc.description || "",
            estimatedHours: svc.estimatedHours,
            slaHours: svc.slaHours ?? null,
            formFields: {
              create: svc.fields.map((field, idx) => ({
                fieldName: field.fieldName,
                label: field.label,
                fieldType: field.fieldType as any,
                isRequired: field.isRequired,
                placeholder: field.placeholder || null,
                options: field.options || [],
                sortOrder: idx,
              })),
            },
          },
        });
        created.push(service.id);
      }

      return { createdCount: created.length, serviceIds: created };
    }),
});

/** Fallback services when AI is not available */
function getDefaultServices(agencyType: string): SuggestedService[] {
  const commonServices: SuggestedService[] = [
    {
      name: "Diseño de Logo",
      description: "Creación o rediseño de logotipo para la marca",
      estimatedHours: 8,
      slaHours: 72,
      fields: [
        { fieldName: "nombre_marca", label: "Nombre de la marca", fieldType: "TEXT", isRequired: true, placeholder: "Ej: Mi Empresa" },
        { fieldName: "estilo_preferido", label: "Estilo preferido", fieldType: "SELECT", isRequired: false, options: ["Minimalista", "Moderno", "Clásico", "Divertido", "Corporativo"] },
        { fieldName: "colores_referencia", label: "Colores de referencia", fieldType: "TEXT", isRequired: false, placeholder: "Ej: Azul y blanco" },
        { fieldName: "referencias_visuales", label: "Referencias visuales", fieldType: "FILE", isRequired: false },
      ],
    },
    {
      name: "Publicación en Redes Sociales",
      description: "Diseño y publicación de contenido en redes sociales",
      estimatedHours: 2,
      slaHours: 24,
      fields: [
        { fieldName: "red_social", label: "Red social", fieldType: "MULTISELECT", isRequired: true, options: ["Instagram", "Facebook", "Twitter/X", "LinkedIn", "TikTok"] },
        { fieldName: "tipo_contenido", label: "Tipo de contenido", fieldType: "SELECT", isRequired: true, options: ["Imagen", "Carrusel", "Video corto", "Historia", "Reel"] },
        { fieldName: "texto_publicacion", label: "Texto o copy", fieldType: "TEXTAREA", isRequired: false, placeholder: "Texto que acompañará la publicación" },
        { fieldName: "fecha_publicacion", label: "Fecha deseada de publicación", fieldType: "DATE", isRequired: false },
      ],
    },
    {
      name: "Página Web Landing",
      description: "Diseño y desarrollo de landing page",
      estimatedHours: 16,
      slaHours: null,
      fields: [
        { fieldName: "objetivo", label: "Objetivo de la landing", fieldType: "SELECT", isRequired: true, options: ["Captar leads", "Vender producto", "Evento", "Informativa"] },
        { fieldName: "contenido_principal", label: "Contenido principal", fieldType: "TEXTAREA", isRequired: true, placeholder: "Describe qué información debe incluir" },
        { fieldName: "url_referencia", label: "URL de referencia", fieldType: "URL", isRequired: false, placeholder: "https://ejemplo.com" },
        { fieldName: "incluir_formulario", label: "Incluir formulario de contacto", fieldType: "CHECKBOX", isRequired: false },
      ],
    },
  ];

  const typeSpecific: Record<string, SuggestedService[]> = {
    marketing_digital: [
      {
        name: "Campaña de Google Ads",
        description: "Configuración y gestión de campañas en Google Ads",
        estimatedHours: 6,
        slaHours: 48,
        fields: [
          { fieldName: "presupuesto_mensual", label: "Presupuesto mensual (USD)", fieldType: "NUMBER", isRequired: true, placeholder: "500" },
          { fieldName: "objetivo_campana", label: "Objetivo", fieldType: "SELECT", isRequired: true, options: ["Tráfico web", "Conversiones", "Awareness", "Descargas"] },
          { fieldName: "palabras_clave", label: "Palabras clave sugeridas", fieldType: "TEXTAREA", isRequired: false },
        ],
      },
    ],
    diseno_grafico: [
      {
        name: "Diseño de Flyer / Volante",
        description: "Diseño de material impreso o digital",
        estimatedHours: 3,
        slaHours: 24,
        fields: [
          { fieldName: "formato", label: "Formato", fieldType: "SELECT", isRequired: true, options: ["Digital", "Impreso A4", "Impreso A5", "Medio carta"] },
          { fieldName: "informacion_incluir", label: "Información a incluir", fieldType: "TEXTAREA", isRequired: true },
          { fieldName: "imagenes_referencia", label: "Imágenes de referencia", fieldType: "FILE", isRequired: false },
        ],
      },
    ],
    desarrollo_web: [
      {
        name: "Corrección de Bug",
        description: "Identificación y corrección de errores en el sitio web",
        estimatedHours: 2,
        slaHours: 8,
        fields: [
          { fieldName: "url_afectada", label: "URL afectada", fieldType: "URL", isRequired: true },
          { fieldName: "descripcion_error", label: "Descripción del error", fieldType: "TEXTAREA", isRequired: true, placeholder: "Describe qué está fallando" },
          { fieldName: "prioridad", label: "Prioridad", fieldType: "SELECT", isRequired: true, options: ["Crítico", "Alto", "Medio", "Bajo"] },
        ],
      },
    ],
  };

  return [...commonServices, ...(typeSpecific[agencyType] || [])];
}
