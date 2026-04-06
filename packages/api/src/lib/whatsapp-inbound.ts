import type { PrismaClient } from "@isytask/db";
import { chatCompletion } from "./openrouter";
import { sendWhatsAppMessage } from "./whatsapp";
import { notifyNewComment } from "./notifications";

// ── Types ──

interface InboundMessage {
  from: string; // E.164 phone number
  body: string;
  messageSid: string;
  mediaUrl?: string;
  mediaContentType?: string;
  profileName?: string;
}

interface TaskMatchResult {
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  serviceName: string;
  confidence: number;
  reasoning: string;
}

// ── Main Handler ──

/**
 * Process an inbound WhatsApp message:
 * 1. Find or create the WhatsAppContact
 * 2. Log the message
 * 3. Match to a task using AI
 * 4. Create a comment on the matched task
 * 5. Reply to the client with confirmation
 */
export async function handleInboundWhatsApp({
  db,
  message,
}: {
  db: PrismaClient;
  message: InboundMessage;
}): Promise<void> {
  const { from, body, messageSid, mediaUrl, mediaContentType, profileName } =
    message;

  // Clean phone number to E.164
  const phone = normalizePhone(from);

  console.log(`[WhatsApp Inbound] From: ${phone}, Body: "${body.slice(0, 80)}..."`);

  // ─── 1. Find or create contact ───
  let contact = await db.whatsAppContact.findUnique({
    where: { phone },
    include: {
      user: { select: { id: true, name: true, role: true } },
      client: {
        select: {
          id: true,
          userId: true,
          companyName: true,
          user: { select: { id: true, name: true, agencyId: true } },
        },
      },
    },
  });

  if (!contact) {
    // Try to auto-link by matching phone to a user
    const matchedUser = await db.user.findFirst({
      where: { phone, isActive: true },
      include: {
        clientProfile: { select: { id: true } },
      },
    });

    contact = await db.whatsAppContact.create({
      data: {
        phone,
        displayName: profileName || null,
        userId: matchedUser?.id || null,
        clientId: matchedUser?.clientProfile?.id || null,
        isVerified: !!matchedUser, // Auto-verified if phone matches a user
        lastMessageAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        client: {
          select: {
            id: true,
            userId: true,
            companyName: true,
            user: { select: { id: true, name: true, agencyId: true } },
          },
        },
      },
    });
  } else {
    // Update last message time and display name
    await db.whatsAppContact.update({
      where: { id: contact.id },
      data: {
        lastMessageAt: new Date(),
        ...(profileName && !contact.displayName
          ? { displayName: profileName }
          : {}),
      },
    });
  }

  // ─── 2. Log the inbound message ───
  const waMessage = await db.whatsAppMessage.create({
    data: {
      contactId: contact.id,
      twilioSid: messageSid,
      direction: "inbound",
      body,
      mediaUrl: mediaUrl || null,
      mediaType: mediaContentType || null,
      status: "RECEIVED",
    },
  });

  // ─── 3. Check if contact is linked to a client ───
  if (!contact.client) {
    // Unlinked contact — notify admin and reply
    await db.whatsAppMessage.update({
      where: { id: waMessage.id },
      data: { status: "UNMATCHED" },
    });

    await sendWhatsAppMessage({
      db,
      to: phone,
      body: "Hola! Tu número no está vinculado a una cuenta de cliente en Isytask. Por favor, contacta a tu administrador para vincular tu número.",
    });
    return;
  }

  const clientId = contact.client.id;
  const userId = contact.client.userId;
  const agencyId = contact.client.user.agencyId;

  if (!agencyId) {
    await db.whatsAppMessage.update({
      where: { id: waMessage.id },
      data: { status: "FAILED" },
    });
    return;
  }

  // ─── 4. Find active tasks for this client ───
  const activeTasks = await db.task.findMany({
    where: {
      clientId,
      agencyId,
      status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION"] },
    },
    select: {
      id: true,
      taskNumber: true,
      title: true,
      status: true,
      description: true,
      service: { select: { name: true } },
      comments: {
        select: { content: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  if (activeTasks.length === 0) {
    await db.whatsAppMessage.update({
      where: { id: waMessage.id },
      data: { status: "UNMATCHED" },
    });

    await sendWhatsAppMessage({
      db,
      to: phone,
      body: "No tienes tareas activas en este momento. Si necesitas crear una nueva tarea, por favor ingresa a Isytask.",
    });
    return;
  }

  // ─── 5. AI matching: determine which task the message is about ───
  const matchResult = await matchMessageToTask({
    db,
    messageBody: body,
    tasks: activeTasks,
    clientName: contact.client.companyName || contact.user?.name || "Cliente",
  });

  if (!matchResult || matchResult.confidence < 0.4) {
    // Low confidence — ask the client to clarify
    await db.whatsAppMessage.update({
      where: { id: waMessage.id },
      data: {
        status: "UNMATCHED",
        aiConfidence: matchResult?.confidence || 0,
        aiReasoning: matchResult?.reasoning || "No match found",
      },
    });

    const taskList = activeTasks
      .slice(0, 5)
      .map((t) => `  #${t.taskNumber} - ${t.title}`)
      .join("\n");

    await sendWhatsAppMessage({
      db,
      to: phone,
      body: `No pude identificar a cuál tarea te refieres. Tus tareas activas son:\n\n${taskList}\n\nResponde con el número de tarea (ej: "#${activeTasks[0].taskNumber} tu mensaje aquí")`,
    });
    return;
  }

  // ─── 6. Create comment on the matched task ───
  const comment = await db.taskComment.create({
    data: {
      taskId: matchResult.taskId,
      authorId: userId,
      content: `[WhatsApp] ${body}`,
      isQuestion: false,
    },
  });

  // Update the WhatsApp message with match info
  await db.whatsAppMessage.update({
    where: { id: waMessage.id },
    data: {
      status: "COMMENT_CREATED",
      matchedTaskId: matchResult.taskId,
      commentId: comment.id,
      aiConfidence: matchResult.confidence,
      aiReasoning: matchResult.reasoning,
    },
  });

  // ─── 7. Notify task participants ───
  const task = await db.task.findUnique({
    where: { id: matchResult.taskId },
    include: {
      client: { select: { userId: true } },
      service: { select: { name: true } },
    },
  });

  if (task) {
    notifyNewComment({
      db,
      task: {
        id: task.id,
        taskNumber: matchResult.taskNumber,
        agencyId: task.agencyId,
        clientId: task.clientId,
        colaboradorId: task.colaboradorId,
        client: { userId: task.client.userId },
        service: { name: task.service.name },
      },
      commentAuthorId: userId,
    }).catch(() => {});
  }

  // ─── 8. Reply to client ───
  await sendWhatsAppMessage({
    db,
    to: phone,
    body: `Tu mensaje se agregó como comentario a la tarea #${matchResult.taskNumber} (${matchResult.taskTitle}). El equipo será notificado.`,
  });

  console.log(
    `[WhatsApp Inbound] Message matched to task #${matchResult.taskNumber} (confidence: ${matchResult.confidence})`
  );
}

// ── AI Task Matching ──

async function matchMessageToTask({
  db,
  messageBody,
  tasks,
  clientName,
}: {
  db: PrismaClient;
  messageBody: string;
  tasks: Array<{
    id: string;
    taskNumber: number;
    title: string;
    status: string;
    description: string | null;
    service: { name: string };
    comments: Array<{ content: string; createdAt: Date }>;
  }>;
  clientName: string;
}): Promise<TaskMatchResult | null> {
  // Quick check: if message explicitly mentions a task number like "#123"
  const taskNumberMatch = messageBody.match(/#(\d+)/);
  if (taskNumberMatch) {
    const num = parseInt(taskNumberMatch[1], 10);
    const directMatch = tasks.find((t) => t.taskNumber === num);
    if (directMatch) {
      return {
        taskId: directMatch.id,
        taskNumber: directMatch.taskNumber,
        taskTitle: directMatch.title,
        serviceName: directMatch.service.name,
        confidence: 1.0,
        reasoning: `El cliente mencionó directamente el número de tarea #${num}`,
      };
    }
  }

  // If only one active task, match directly
  if (tasks.length === 1) {
    return {
      taskId: tasks[0].id,
      taskNumber: tasks[0].taskNumber,
      taskTitle: tasks[0].title,
      serviceName: tasks[0].service.name,
      confidence: 0.85,
      reasoning: "El cliente solo tiene una tarea activa",
    };
  }

  // Use AI to match
  const tasksContext = tasks
    .map((t) => {
      const recentComments = t.comments
        .map((c) => `    - ${c.content.slice(0, 100)}`)
        .join("\n");
      return `  Tarea #${t.taskNumber}: "${t.title}" (servicio: ${t.service.name}, estado: ${t.status})
    Descripción: ${t.description?.slice(0, 150) || "Sin descripción"}
${recentComments ? `    Últimos comentarios:\n${recentComments}` : ""}`;
    })
    .join("\n\n");

  const prompt = `Eres un asistente que analiza mensajes de WhatsApp de clientes de una agencia creativa.

El cliente "${clientName}" envió este mensaje por WhatsApp:
"${messageBody}"

Estas son sus tareas activas:
${tasksContext}

Determina a cuál tarea se refiere el mensaje. Responde SOLO con un JSON válido:
{
  "taskNumber": <número de la tarea más probable>,
  "confidence": <0.0 a 1.0>,
  "reasoning": "<explicación breve en español>"
}

Reglas:
- Si el mensaje claramente se refiere a una tarea específica, confidence >= 0.7
- Si es ambiguo pero hay una probable, confidence 0.4-0.7
- Si no puedes determinar la tarea, confidence < 0.4
- Considera el contexto: tipo de servicio, comentarios recientes, palabras clave`;

  const aiResponse = await chatCompletion({
    db,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    maxTokens: 256,
  });

  if (!aiResponse) return null;

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const matchedTask = tasks.find(
      (t) => t.taskNumber === parsed.taskNumber
    );

    if (!matchedTask) return null;

    return {
      taskId: matchedTask.id,
      taskNumber: matchedTask.taskNumber,
      taskTitle: matchedTask.title,
      serviceName: matchedTask.service.name,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      reasoning: parsed.reasoning || "Match por IA",
    };
  } catch {
    console.error("[WhatsApp AI] Failed to parse AI response:", aiResponse);
    return null;
  }
}

// ── Helpers ──

function normalizePhone(phone: string): string {
  // Remove "whatsapp:" prefix if present
  let cleaned = phone.replace(/^whatsapp:/, "");
  // Remove spaces
  cleaned = cleaned.replace(/\s+/g, "");
  // Ensure starts with +
  if (!cleaned.startsWith("+")) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}
