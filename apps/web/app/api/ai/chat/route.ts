import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@isytask/db";
import {
  streamChatCompletion,
  buildServiceAgentSystemPrompt,
  buildFieldExtractionTools,
} from "@isytask/api";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    // 2. Parse request
    const body = await req.json();
    const { serviceId, messages, currentFormState } = body as {
      serviceId: string;
      messages: { role: "user" | "assistant"; content: string }[];
      currentFormState: Record<string, any>;
    };

    if (!serviceId || !messages || !Array.isArray(messages)) {
      return new Response("Datos inválidos", { status: 400 });
    }

    // 3. Check global AI config
    const aiEnabled = await db.systemConfig
      .findUnique({ where: { key: "ai_agent_enabled" } })
      .then((c) => c?.value ?? false);
    if (!aiEnabled) {
      return new Response("Agente IA no habilitado", { status: 503 });
    }

    // 4. Fetch service with agent config and form fields
    const service = await db.service.findUnique({
      where: { id: serviceId },
      include: {
        formFields: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!service) {
      return new Response("Servicio no encontrado", { status: 404 });
    }

    if (!service.agentEnabled) {
      return new Response("Agente no habilitado para este servicio", {
        status: 400,
      });
    }

    // 5. Build system prompt
    const systemPrompt = buildServiceAgentSystemPrompt({
      serviceName: service.name,
      serviceInstructions: service.agentInstructions || "",
      formFields: service.formFields.map((f) => ({
        fieldName: f.fieldName,
        label: f.label,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        options: (f.options as string[]) || undefined,
        placeholder: f.placeholder || undefined,
      })),
      currentFormState: currentFormState || {},
    });

    // 6. Build tools from form fields
    const tools = buildFieldExtractionTools(
      service.formFields.map((f) => ({
        fieldName: f.fieldName,
        label: f.label,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        options: (f.options as string[]) || undefined,
        placeholder: f.placeholder || undefined,
      }))
    );

    // 7. Compose full messages with system prompt
    const fullMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // 8. Call OpenRouter and get stream
    const stream = await streamChatCompletion({
      db,
      messages: fullMessages,
      tools,
      model: service.agentModel || undefined,
    });

    if (!stream) {
      return new Response("Servicio de IA no disponible", { status: 503 });
    }

    // 9. Return SSE stream
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    return new Response("Error interno del servidor", { status: 500 });
  }
}
