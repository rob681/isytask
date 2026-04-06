import type { PrismaClient } from "@isytask/db";
import { chatCompletion } from "./openrouter";

// ── Types ──

interface TaskRiskFactors {
  taskId: string;
  taskNumber: number;
  title: string;
  serviceName: string;
  status: string;
  category: string;
  daysUntilDeadline: number | null;
  daysSinceLastClientResponse: number | null;
  daysSinceLastUpdate: number;
  assigneeActiveTaskCount: number | null;
  clientAvgApprovalDays: number | null;
  teamAvgCompletionDays: number | null;
  estimatedHours: number;
  daysInCurrentStatus: number;
}

interface RiskResult {
  riskScore: number; // 0-100
  riskLevel: "GREEN" | "YELLOW" | "RED";
  prediction: string;
  suggestedAction: string | null;
}

// ── Main Analysis Function ──

/**
 * Analyze all active tasks for an agency and compute risk assessments.
 * Called by the daily cron job.
 */
export async function analyzeAgencyRisks({
  db,
  agencyId,
}: {
  db: PrismaClient;
  agencyId: string;
}): Promise<{ analyzed: number; red: number; yellow: number }> {
  const now = new Date();

  // ─── 1. Get all active tasks ───
  const activeTasks = await db.task.findMany({
    where: {
      agencyId,
      status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION"] },
    },
    include: {
      client: {
        select: {
          id: true,
          userId: true,
          companyName: true,
          user: { select: { name: true } },
        },
      },
      service: { select: { name: true } },
      colaborador: { select: { id: true, userId: true } },
      assignments: {
        select: { colaboradorId: true },
      },
      comments: {
        select: {
          authorId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      statusLog: {
        select: { createdAt: true, toStatus: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (activeTasks.length === 0) return { analyzed: 0, red: 0, yellow: 0 };

  // ─── 2. Compute metrics per client ───
  const clientMetrics = await computeClientMetrics(db, agencyId);

  // ─── 3. Compute metrics per collaborator ───
  const colaboradorMetrics = await computeColaboradorMetrics(db, agencyId);

  // ─── 4. Count active tasks per assignee ───
  const assigneeTaskCounts = await db.task.groupBy({
    by: ["colaboradorId"],
    where: {
      agencyId,
      status: { in: ["RECIBIDA", "EN_PROGRESO", "DUDA", "REVISION"] },
      colaboradorId: { not: null },
    },
    _count: true,
  });

  const taskCountMap = new Map<string, number>();
  for (const g of assigneeTaskCounts) {
    if (g.colaboradorId) taskCountMap.set(g.colaboradorId, g._count);
  }

  // ─── 5. Analyze each task ───
  let redCount = 0;
  let yellowCount = 0;

  const riskFactorsList: TaskRiskFactors[] = [];

  for (const task of activeTasks) {
    // Days until deadline
    const daysUntilDeadline = task.dueAt
      ? Math.ceil(
          (task.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    // Days since last client response (comment by client)
    const clientComments = task.comments.filter(
      (c) => c.authorId === task.client.userId
    );
    const lastClientComment = clientComments[0];
    const daysSinceLastClientResponse = lastClientComment
      ? Math.ceil(
          (now.getTime() - lastClientComment.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    // Days since last update (any comment or status change)
    const lastActivity = Math.max(
      task.comments[0]?.createdAt.getTime() ?? 0,
      task.statusLog[0]?.createdAt.getTime() ?? 0,
      task.updatedAt.getTime()
    );
    const daysSinceLastUpdate = Math.ceil(
      (now.getTime() - lastActivity) / (1000 * 60 * 60 * 24)
    );

    // Days in current status
    const lastStatusChange = task.statusLog[0];
    const daysInCurrentStatus = lastStatusChange
      ? Math.ceil(
          (now.getTime() - lastStatusChange.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : Math.ceil(
          (now.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

    // Assignee workload
    const assigneeId = task.colaboradorId;
    const assigneeActiveTaskCount = assigneeId
      ? taskCountMap.get(assigneeId) ?? null
      : null;

    // Client historical avg
    const clientAvgApprovalDays =
      clientMetrics.get(task.client.id) ?? null;

    // Colaborador historical avg
    const teamAvgCompletionDays = assigneeId
      ? colaboradorMetrics.get(assigneeId) ?? null
      : null;

    const factors: TaskRiskFactors = {
      taskId: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      serviceName: task.service.name,
      status: task.status,
      category: task.category,
      daysUntilDeadline,
      daysSinceLastClientResponse,
      daysSinceLastUpdate,
      assigneeActiveTaskCount,
      clientAvgApprovalDays,
      teamAvgCompletionDays,
      estimatedHours: task.estimatedHours,
      daysInCurrentStatus,
    };

    riskFactorsList.push(factors);

    // ─── 6. Compute risk score ───
    const riskResult = computeRiskScore(factors);

    if (riskResult.riskLevel === "RED") redCount++;
    else if (riskResult.riskLevel === "YELLOW") yellowCount++;

    // ─── 7. Upsert risk assessment ───
    await db.riskAssessment.upsert({
      where: { taskId: task.id },
      create: {
        taskId: task.id,
        agencyId,
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        daysUntilDeadline,
        daysSinceLastClientResponse,
        daysSinceLastUpdate,
        assigneeActiveTaskCount,
        clientAvgApprovalDays,
        teamAvgCompletionDays,
        prediction: riskResult.prediction,
        suggestedAction: riskResult.suggestedAction,
        analyzedAt: now,
      },
      update: {
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        daysUntilDeadline,
        daysSinceLastClientResponse,
        daysSinceLastUpdate,
        assigneeActiveTaskCount,
        clientAvgApprovalDays,
        teamAvgCompletionDays,
        prediction: riskResult.prediction,
        suggestedAction: riskResult.suggestedAction,
        analyzedAt: now,
      },
    });
  }

  // ─── 8. Generate AI insights for RED tasks ───
  const redTasks = riskFactorsList.filter((f) => {
    const score = computeRiskScore(f);
    return score.riskLevel === "RED";
  });

  if (redTasks.length > 0) {
    await generateAIInsights(db, agencyId, redTasks);
  }

  // ─── 9. Clean up assessments for no-longer-active tasks ───
  await db.riskAssessment.deleteMany({
    where: {
      agencyId,
      taskId: { notIn: activeTasks.map((t) => t.id) },
    },
  });

  return { analyzed: activeTasks.length, red: redCount, yellow: yellowCount };
}

// ── Risk Score Calculator ──

function computeRiskScore(factors: TaskRiskFactors): RiskResult {
  let score = 0;
  const warnings: string[] = [];

  // --- Deadline proximity (0-35 points) ---
  if (factors.daysUntilDeadline !== null) {
    if (factors.daysUntilDeadline < 0) {
      score += 35; // OVERDUE
      warnings.push(
        `La tarea está ${Math.abs(factors.daysUntilDeadline)} día(s) retrasada`
      );
    } else if (factors.daysUntilDeadline <= 1) {
      score += 30;
      warnings.push("La fecha de entrega es mañana o hoy");
    } else if (factors.daysUntilDeadline <= 3) {
      score += 20;
      warnings.push(`Solo quedan ${factors.daysUntilDeadline} días para la entrega`);
    } else if (factors.daysUntilDeadline <= 7) {
      score += 10;
    }
  }

  // --- Client response delay (0-25 points) ---
  if (factors.daysSinceLastClientResponse !== null) {
    if (factors.daysSinceLastClientResponse >= 5) {
      score += 25;
      warnings.push(
        `El cliente no responde desde hace ${factors.daysSinceLastClientResponse} días`
      );
    } else if (factors.daysSinceLastClientResponse >= 3) {
      score += 15;
      warnings.push(
        `El cliente no responde desde hace ${factors.daysSinceLastClientResponse} días`
      );
    } else if (factors.daysSinceLastClientResponse >= 2) {
      score += 8;
    }
  }

  // --- Stale task (no activity) (0-20 points) ---
  if (factors.daysSinceLastUpdate >= 5) {
    score += 20;
    warnings.push(
      `Sin actividad desde hace ${factors.daysSinceLastUpdate} días`
    );
  } else if (factors.daysSinceLastUpdate >= 3) {
    score += 12;
    warnings.push(`Sin actividad desde hace ${factors.daysSinceLastUpdate} días`);
  } else if (factors.daysSinceLastUpdate >= 2) {
    score += 5;
  }

  // --- Assignee overload (0-10 points) ---
  if (factors.assigneeActiveTaskCount !== null) {
    if (factors.assigneeActiveTaskCount >= 8) {
      score += 10;
      warnings.push(
        `El asignado tiene ${factors.assigneeActiveTaskCount} tareas activas`
      );
    } else if (factors.assigneeActiveTaskCount >= 5) {
      score += 5;
    }
  }

  // --- Status-specific risks (0-10 points) ---
  if (factors.status === "DUDA") {
    score += 10;
    warnings.push("La tarea tiene una duda pendiente de resolver");
  } else if (
    factors.status === "REVISION" &&
    factors.daysInCurrentStatus >= 3
  ) {
    score += 8;
    warnings.push(
      `Lleva ${factors.daysInCurrentStatus} días en revisión sin avance`
    );
  } else if (
    factors.status === "RECIBIDA" &&
    factors.daysInCurrentStatus >= 2
  ) {
    score += 5;
    warnings.push("La tarea no ha sido iniciada aún");
  }

  // --- Historical client slowness (0-5 bonus) ---
  if (
    factors.clientAvgApprovalDays !== null &&
    factors.clientAvgApprovalDays >= 4
  ) {
    score += 5;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let riskLevel: "GREEN" | "YELLOW" | "RED";
  if (score >= 50) riskLevel = "RED";
  else if (score >= 25) riskLevel = "YELLOW";
  else riskLevel = "GREEN";

  // Build prediction
  const prediction =
    warnings.length > 0
      ? warnings.join(". ") + "."
      : "La tarea está progresando normalmente.";

  // Suggest action
  let suggestedAction: string | null = null;
  if (riskLevel === "RED") {
    if (
      factors.daysSinceLastClientResponse &&
      factors.daysSinceLastClientResponse >= 3
    ) {
      suggestedAction = "Envía un recordatorio de aprobación al cliente ahora mismo.";
    } else if (factors.daysUntilDeadline !== null && factors.daysUntilDeadline < 0) {
      suggestedAction = "Contacta al cliente para renegociar la fecha de entrega.";
    } else if (
      factors.assigneeActiveTaskCount &&
      factors.assigneeActiveTaskCount >= 8
    ) {
      suggestedAction = "Considera reasignar esta tarea a otro miembro del equipo.";
    } else if (factors.status === "DUDA") {
      suggestedAction = "Resuelve la duda pendiente para desbloquear el progreso.";
    } else {
      suggestedAction = "Revisa esta tarea urgentemente y toma acción inmediata.";
    }
  } else if (riskLevel === "YELLOW") {
    if (factors.daysSinceLastUpdate >= 3) {
      suggestedAction = "Actualiza el estado de esta tarea para mantener al cliente informado.";
    } else if (
      factors.daysSinceLastClientResponse &&
      factors.daysSinceLastClientResponse >= 2
    ) {
      suggestedAction = "Considera enviar un recordatorio amigable al cliente.";
    }
  }

  return { riskScore: score, riskLevel, prediction, suggestedAction };
}

// ── AI Insights for Critical Tasks ──

async function generateAIInsights(
  db: PrismaClient,
  agencyId: string,
  redTasks: TaskRiskFactors[]
): Promise<void> {
  if (redTasks.length === 0) return;

  const tasksDescription = redTasks
    .slice(0, 5) // Limit to 5 to control token usage
    .map(
      (t) =>
        `- Tarea #${t.taskNumber} "${t.title}" (${t.serviceName}): ` +
        `deadline en ${t.daysUntilDeadline ?? "N/A"} días, ` +
        `cliente sin responder ${t.daysSinceLastClientResponse ?? "N/A"} días, ` +
        `sin actividad ${t.daysSinceLastUpdate} días, ` +
        `asignado con ${t.assigneeActiveTaskCount ?? "N/A"} tareas activas, ` +
        `estado: ${t.status}`
    )
    .join("\n");

  const aiResponse = await chatCompletion({
    db,
    messages: [
      {
        role: "system",
        content: `Eres un asistente de gestión de proyectos para una agencia creativa. Analiza las tareas de alto riesgo y genera predicciones precisas y accionables en español. Sé directo y específico. Máximo 2-3 oraciones por tarea.`,
      },
      {
        role: "user",
        content: `Estas tareas tienen alto riesgo de retraso. Para cada una, genera una predicción breve y una acción sugerida:

${tasksDescription}

Responde en JSON: [{"taskNumber": N, "prediction": "...", "suggestedAction": "..."}]`,
      },
    ],
    temperature: 0.3,
    maxTokens: 1024,
  });

  if (!aiResponse) return;

  try {
    const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return;

    const insights = JSON.parse(jsonMatch[0]) as Array<{
      taskNumber: number;
      prediction: string;
      suggestedAction: string;
    }>;

    for (const insight of insights) {
      const task = redTasks.find((t) => t.taskNumber === insight.taskNumber);
      if (!task) continue;

      await db.riskAssessment.update({
        where: { taskId: task.taskId },
        data: {
          prediction: insight.prediction,
          suggestedAction: insight.suggestedAction,
        },
      });
    }
  } catch {
    console.error("[RiskEngine] Failed to parse AI insights");
  }
}

// ── Metric Helpers ──

/**
 * Compute average approval/response time per client.
 * Looks at completed tasks to measure how long clients took to respond.
 */
async function computeClientMetrics(
  db: PrismaClient,
  agencyId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  // Get completed tasks from the last 90 days with their timeline
  const completedTasks = await db.task.findMany({
    where: {
      agencyId,
      status: "FINALIZADA",
      completedAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      clientId: true,
      createdAt: true,
      completedAt: true,
      statusLog: {
        select: { fromStatus: true, toStatus: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Group by client and compute average time in REVISION status
  const clientTimes = new Map<string, number[]>();
  for (const task of completedTasks) {
    // Measure time spent in REVISION (waiting for client approval)
    let revisionDays = 0;
    let revisionStart: Date | null = null;
    for (const log of task.statusLog) {
      if (log.toStatus === "REVISION") {
        revisionStart = log.createdAt;
      } else if (revisionStart && log.fromStatus === "REVISION") {
        revisionDays +=
          (log.createdAt.getTime() - revisionStart.getTime()) /
          (1000 * 60 * 60 * 24);
        revisionStart = null;
      }
    }

    if (revisionDays > 0) {
      const arr = clientTimes.get(task.clientId) || [];
      arr.push(revisionDays);
      clientTimes.set(task.clientId, arr);
    }
  }

  for (const [clientId, times] of clientTimes.entries()) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    result.set(clientId, Math.round(avg * 10) / 10);
  }

  return result;
}

/**
 * Compute average completion time per collaborator.
 */
async function computeColaboradorMetrics(
  db: PrismaClient,
  agencyId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  const completedTasks = await db.task.findMany({
    where: {
      agencyId,
      status: "FINALIZADA",
      completedAt: { not: null },
      colaboradorId: { not: null },
      startedAt: { not: null },
    },
    select: {
      colaboradorId: true,
      startedAt: true,
      completedAt: true,
    },
  });

  const colabTimes = new Map<string, number[]>();
  for (const task of completedTasks) {
    if (!task.colaboradorId || !task.startedAt || !task.completedAt) continue;
    const days =
      (task.completedAt.getTime() - task.startedAt.getTime()) /
      (1000 * 60 * 60 * 24);
    const arr = colabTimes.get(task.colaboradorId) || [];
    arr.push(days);
    colabTimes.set(task.colaboradorId, arr);
  }

  for (const [colabId, times] of colabTimes.entries()) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    result.set(colabId, Math.round(avg * 10) / 10);
  }

  return result;
}

// ── Export for cron ──
export { computeRiskScore, type TaskRiskFactors };
