import type { PrismaClient } from "@isytask/db";

// ── Types ──

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

interface FormFieldInfo {
  fieldName: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  options?: string[];
  placeholder?: string;
}

// ── Config Helper ──

async function getConfig(db: PrismaClient, key: string, defaultValue: any = null) {
  const config = await db.systemConfig.findUnique({ where: { key } });
  return config?.value ?? defaultValue;
}

// ── System Prompt Builder ──

export function buildServiceAgentSystemPrompt({
  serviceName,
  serviceInstructions,
  formFields,
  currentFormState,
}: {
  serviceName: string;
  serviceInstructions: string;
  formFields: FormFieldInfo[];
  currentFormState: Record<string, any>;
}): string {
  const fieldsDescription = formFields
    .map((f) => {
      let desc = `- **${f.label}** (campo: "${f.fieldName}", tipo: ${f.fieldType}`;
      if (f.isRequired) desc += ", OBLIGATORIO";
      if (f.options && f.options.length > 0)
        desc += `, opciones: [${f.options.join(", ")}]`;
      if (f.placeholder) desc += `, ejemplo: "${f.placeholder}"`;
      desc += ")";
      return desc;
    })
    .join("\n");

  const filledFields = Object.entries(currentFormState)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join("\n");

  return `Eres un asistente de IA que ayuda a un cliente a crear una solicitud de tarea para el servicio "${serviceName}".

## Tus instrucciones
${serviceInstructions || "Ayuda al cliente a completar el formulario de manera amigable y profesional."}

## Campos disponibles del formulario
El formulario tiene estos campos que debes ayudar al cliente a completar. Cuando obtengas información relevante de la conversación, llama la función update_form_fields para llenar los campos correspondientes.

${fieldsDescription}

## Estado actual del formulario
${filledFields || "(vacío — ningún campo completado aún)"}

## Reglas importantes
1. Conversa naturalmente en español. Sé amigable, breve y profesional.
2. Cuando sepas información para un campo, llama update_form_fields de inmediato.
3. NO preguntes por todos los campos a la vez. Pregunta de 1 a 2 a la vez, de manera conversacional.
4. Prioriza los campos OBLIGATORIOS primero.
5. Si un campo tiene opciones predefinidas (SELECT/MULTISELECT), muéstralas al cliente.
6. Para campos de tipo FILE, indica al cliente que puede subir archivos en el área de adjuntos del formulario.
7. Cuando todos los campos obligatorios estén llenos, avisa al cliente que puede revisar y enviar.
8. Mantén respuestas concisas — máximo 2-3 oraciones por turno.
9. Empieza saludando al cliente y preguntando por el primer campo obligatorio.`;
}

// ── Tool Schema Builder ──

export function buildFieldExtractionTools(
  formFields: FormFieldInfo[]
): ToolDefinition[] {
  const properties: Record<string, any> = {};

  for (const field of formFields) {
    switch (field.fieldType) {
      case "NUMBER":
        properties[field.fieldName] = {
          type: "number",
          description: field.label,
        };
        break;
      case "CHECKBOX":
        properties[field.fieldName] = {
          type: "boolean",
          description: field.label,
        };
        break;
      case "MULTISELECT":
        properties[field.fieldName] = {
          type: "array",
          items: { type: "string" },
          description: `${field.label}${field.options ? ` (opciones: ${field.options.join(", ")})` : ""}`,
        };
        break;
      case "SELECT":
        properties[field.fieldName] = {
          type: "string",
          description: `${field.label}${field.options ? ` (opciones: ${field.options.join(", ")})` : ""}`,
          ...(field.options ? { enum: field.options } : {}),
        };
        break;
      default:
        // TEXT, TEXTAREA, URL, COLOR_PICKER, FILE, DATE
        properties[field.fieldName] = {
          type: "string",
          description: field.label,
        };
    }
  }

  return [
    {
      type: "function",
      function: {
        name: "update_form_fields",
        description:
          "Actualiza los campos del formulario de tarea con la información recopilada de la conversación con el cliente.",
        parameters: {
          type: "object",
          properties,
        },
      },
    },
  ];
}

// ── Stream Chat Completion ──

/**
 * Streams a chat completion from OpenRouter.
 * Returns a ReadableStream that emits SSE events:
 *   event: token    → data: {"content": "..."}
 *   event: tool_call → data: {"name": "...", "arguments": {...}}
 *   event: done     → data: {}
 *   event: error    → data: {"message": "..."}
 */
export async function streamChatCompletion({
  db,
  messages,
  tools,
  model,
}: {
  db: PrismaClient;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  model?: string;
}): Promise<ReadableStream | null> {
  try {
    const apiKey = await getConfig(db, "openrouter_api_key", "");
    if (!apiKey) {
      console.error("[OpenRouter] No API key configured");
      return null;
    }

    const defaultModel = await getConfig(
      db,
      "ai_agent_default_model",
      "openai/gpt-4o-mini"
    );

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://isytask-web.vercel.app",
          "X-Title": "Isytask",
        },
        body: JSON.stringify({
          model: model || defaultModel,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined,
          stream: true,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[OpenRouter] API error:", response.status, errorText);
      return null;
    }

    if (!response.body) {
      console.error("[OpenRouter] No response body");
      return null;
    }

    // Transform the OpenRouter SSE stream into our simplified SSE format
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let buffer = "";
        // Accumulate tool call arguments across multiple chunks
        let toolCallName = "";
        let toolCallArgs = "";

        function emit(event: string, data: any) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const chunk = JSON.parse(dataStr);

                const choice = chunk.choices?.[0];
                const delta = choice?.delta;
                if (!delta) continue;

                // Skip finish chunks that carry no new delta content
                if (choice?.finish_reason && !delta.content && !delta.tool_calls) continue;

                // Text content
                if (delta.content) {
                  emit("token", { content: delta.content });
                }

                // Tool call
                if (delta.tool_calls && delta.tool_calls.length > 0) {
                  const tc = delta.tool_calls[0];
                  if (tc.function?.name) {
                    toolCallName = tc.function.name;
                  }
                  if (tc.function?.arguments) {
                    toolCallArgs += tc.function.arguments;
                  }
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }

          // If we accumulated tool call arguments, emit them
          if (toolCallName && toolCallArgs) {
            try {
              const parsed = JSON.parse(toolCallArgs);
              emit("tool_call", {
                name: toolCallName,
                arguments: parsed,
              });
            } catch {
              console.error("[OpenRouter] Failed to parse tool call args:", toolCallArgs);
            }
          }

          emit("done", {});
        } catch (error) {
          emit("error", {
            message: error instanceof Error ? error.message : "Stream error",
          });
        } finally {
          controller.close();
        }
      },
    });
  } catch (error) {
    console.error("[OpenRouter] Error:", error);
    return null;
  }
}

/**
 * Non-streaming chat completion. Returns the full response text.
 * Used for structured responses (e.g., onboarding service suggestions).
 */
export async function chatCompletion({
  db,
  messages,
  model,
  maxTokens = 2048,
  temperature = 0.7,
}: {
  db: PrismaClient;
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string | null> {
  try {
    const apiKey = await getConfig(db, "openrouter_api_key", "");
    if (!apiKey) {
      console.error("[OpenRouter] No API key configured");
      return null;
    }

    const defaultModel = await getConfig(
      db,
      "ai_agent_default_model",
      "openai/gpt-4o-mini"
    );

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://isytask-web.vercel.app",
          "X-Title": "Isytask",
        },
        body: JSON.stringify({
          model: model || defaultModel,
          messages,
          stream: false,
          max_tokens: maxTokens,
          temperature,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[OpenRouter] API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("[OpenRouter] Error:", error);
    return null;
  }
}
