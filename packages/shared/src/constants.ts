import type { TaskStatus, TaskCategory, Permission } from "./types";

export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard: "Dashboard y métricas",
  manage_tasks: "Gestionar todas las tareas",
  manage_clients: "Gestionar clientes",
  manage_team: "Gestionar equipo",
  manage_services: "Gestionar servicios",
  manage_config: "Configuración del sistema",
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  dashboard: "Ver el panel de métricas y estadísticas generales",
  manage_tasks: "Ver, asignar y cambiar estado de todas las tareas",
  manage_clients: "Ver y editar clientes, asignar colaboradores",
  manage_team: "Ver y gestionar miembros del equipo",
  manage_services: "Crear y editar servicios y sus campos",
  manage_config: "Acceder a la configuración del sistema",
};

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard",
  "manage_tasks",
  "manage_clients",
  "manage_team",
  "manage_services",
  "manage_config",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  RECIBIDA: "Recibida",
  EN_PROGRESO: "En progreso",
  DUDA: "Duda",
  REVISION: "En revisión",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  RECIBIDA: "bg-yellow-100 text-yellow-800",
  EN_PROGRESO: "bg-blue-100 text-blue-800",
  DUDA: "bg-orange-100 text-orange-800",
  REVISION: "bg-purple-100 text-purple-800",
  FINALIZADA: "bg-green-100 text-green-800",
  CANCELADA: "bg-red-100 text-red-800",
};

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  URGENTE: "Urgente",
  NORMAL: "Normal",
  LARGO_PLAZO: "Largo plazo",
};

export const TASK_CATEGORY_COLORS: Record<TaskCategory, string> = {
  URGENTE: "bg-red-500",
  NORMAL: "bg-green-500",
  LARGO_PLAZO: "bg-yellow-500",
};

export const TASK_CATEGORY_BADGE_COLORS: Record<TaskCategory, string> = {
  URGENTE: "!bg-red-500 !text-white !border-transparent",
  NORMAL: "!bg-green-500 !text-white !border-transparent",
  LARGO_PLAZO: "!bg-yellow-500 !text-white !border-transparent",
};

export const NOTIFICATION_TEMPLATES = {
  TAREA_RECIBIDA: {
    title: "Nueva tarea recibida",
    body: (d: Record<string, string>) =>
      `Tu solicitud de ${d.serviceType} ha sido recibida. Te notificaremos cuando comience.`,
    whatsappTemplate: "tarea_recibida",
  },
  TAREA_EN_PROGRESO: {
    title: "Tarea en progreso",
    body: (d: Record<string, string>) =>
      `Tu tarea #${d.taskNumber} (${d.serviceType}) está ahora en progreso.`,
    whatsappTemplate: "tarea_en_progreso",
  },
  TAREA_DUDA: {
    title: "Pregunta sobre tu tarea",
    body: (d: Record<string, string>) =>
      `El equipo tiene una pregunta sobre tu tarea #${d.taskNumber}. Revisa los comentarios.`,
    whatsappTemplate: "tarea_duda",
  },
  TAREA_EN_REVISION: {
    title: "Tarea en revisión",
    body: (d: Record<string, string>) =>
      `La tarea #${d.taskNumber} (${d.serviceType}) ha sido enviada a revisión. Revisa y aprueba el resultado.`,
    whatsappTemplate: "tarea_en_revision",
  },
  TAREA_FINALIZADA: {
    title: "Tarea finalizada",
    body: (d: Record<string, string>) =>
      `Tu tarea #${d.taskNumber} ha sido completada. Revisa los entregables.`,
    whatsappTemplate: "tarea_finalizada",
  },
  TAREA_CANCELADA: {
    title: "Tarea cancelada",
    body: (d: Record<string, string>) =>
      `Tu tarea #${d.taskNumber} ha sido cancelada.`,
    whatsappTemplate: "tarea_cancelada",
  },
  NUEVO_COMENTARIO: {
    title: "Nuevo comentario",
    body: (d: Record<string, string>) =>
      `Hay un nuevo comentario en tu tarea #${d.taskNumber}.`,
    whatsappTemplate: "nuevo_comentario",
  },
  CAMBIO_SOLICITADO: {
    title: "Cambio solicitado",
    body: (d: Record<string, string>) =>
      `Se ha solicitado un cambio en la tarea #${d.taskNumber}.`,
    whatsappTemplate: "cambio_solicitado",
  },
  TAREA_PENDIENTE_RECORDATORIO: {
    title: "Tienes tareas pendientes",
    body: (d: Record<string, string>) =>
      `La tarea #${d.taskNumber} (${d.serviceType}) lleva ${d.hours} horas sin ser activada. Por favor revísala.`,
    whatsappTemplate: "tarea_pendiente_recordatorio",
  },
  SLA_ALERTA: {
    title: "Alerta de SLA",
    body: (d: Record<string, string>) =>
      `La tarea #${d.taskNumber} (${d.serviceType}) está próxima a vencer su SLA. Tiempo restante: ${d.remaining}.`,
    whatsappTemplate: "sla_alerta",
  },
} as const;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN: "Administrador",
  COLABORADOR: "Colaborador",
  CLIENTE: "Cliente",
};
