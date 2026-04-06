export type Role = "SUPER_ADMIN" | "ADMIN" | "COLABORADOR" | "CLIENTE" | "SOPORTE" | "FACTURACION" | "VENTAS" | "ANALISTA";

export type PlatformStaffRole = "SOPORTE" | "FACTURACION" | "VENTAS" | "ANALISTA";
export const PLATFORM_STAFF_ROLES: PlatformStaffRole[] = ["SOPORTE", "FACTURACION", "VENTAS", "ANALISTA"];
export const PLATFORM_ROLES: Role[] = ["SUPER_ADMIN", "SOPORTE", "FACTURACION", "VENTAS", "ANALISTA"];

export type Permission =
  | "dashboard"
  | "manage_tasks"
  | "manage_clients"
  | "manage_team"
  | "manage_services"
  | "manage_config";

export type TaskStatus =
  | "RECIBIDA"
  | "EN_PROGRESO"
  | "DUDA"
  | "REVISION"
  | "FINALIZADA"
  | "CANCELADA";

export type TaskCategory = "URGENTE" | "NORMAL" | "LARGO_PLAZO";

export type NotificationChannel = "EMAIL" | "WHATSAPP" | "IN_APP";

export type NotificationType =
  | "TAREA_RECIBIDA"
  | "TAREA_EN_PROGRESO"
  | "TAREA_DUDA"
  | "TAREA_EN_REVISION"
  | "TAREA_FINALIZADA"
  | "TAREA_CANCELADA"
  | "NUEVO_COMENTARIO"
  | "CAMBIO_SOLICITADO"
  | "TAREA_PENDIENTE_RECORDATORIO"
  | "SLA_ALERTA"
  | "ISYSOCIAL_POST_RECHAZADO"
  | "ISYSOCIAL_POST_APROBADO"
  | "ISYSOCIAL_OAUTH_EXPIRADO"
  | "ISYSOCIAL_CONTENIDO_PUBLICADO";

// Cross-app event types for Isytask ↔ Isysocial integration
export type CrossAppEventType =
  // Isysocial → Isytask
  | "POST_REJECTED"          // Post rechazado → crear/reabrir tarea
  | "POST_APPROVED"          // Post aprobado → finalizar tarea
  | "POST_IN_REVIEW"         // Post enviado a revisión → mover tarea a REVISION
  | "POST_PUBLISHED"         // Post publicado → finalizar tarea
  | "POST_CHANGES_REQUESTED" // Cliente solicita cambios → tarea a EN_PROGRESO + comment
  | "OAUTH_EXPIRED"          // Token OAuth expirado → crear tarea urgente
  // Isytask → Isysocial
  | "TASK_IN_REVISION"       // Tarea pasa a REVISION → mover post a IN_REVIEW
  | "TASK_FINALIZADA"        // Tarea finalizada → mover post a APPROVED
  | "TASK_CANCELLED"         // Tarea cancelada → mover post a CANCELLED
  | "TASK_CREATED_WITH_POST"; // Tarea recurrente creada → crear Post draft

export type FieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "SELECT"
  | "MULTISELECT"
  | "CHECKBOX"
  | "COLOR_PICKER"
  | "FILE"
  | "DATE"
  | "URL";

// ── Ecosystem (multi-product) ──

export type Product = "ISYTASK" | "ISYSOCIAL";
export type PlanTier = "basic" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trial";

export interface SubscriptionInfo {
  product: Product;
  planTier: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
}

export interface QueueTask {
  id: string;
  isOwn: boolean;
  taskNumber?: number;
  clientName: string | null;
  clientAvatar: string | null;
  serviceType: string | null;
  title: string | null;
  category: TaskCategory;
  status: TaskStatus;
  estimatedHours: number;
  elapsedHours: number;
  colaboradorName: string | null;
  hasUnreadComments: boolean;
  commentCount: number;
  createdAt?: Date;
  dueAt?: Date | null;
}
