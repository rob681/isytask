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
  | "SLA_ALERTA";

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
