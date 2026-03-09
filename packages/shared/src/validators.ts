import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(1, "Nombre requerido"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "COLABORADOR", "CLIENTE"]),
});

// Auth flow schemas
export const setupPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Mínimo 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const requestResetSchema = z.object({
  email: z.string().email("Email inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Mínimo 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const validateTokenSchema = z.object({
  token: z.string().min(1),
  type: z.enum(["INVITATION", "PASSWORD_RESET"]),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida"),
  newPassword: z.string().min(6, "Mínimo 6 caracteres"),
  confirmNewPassword: z.string().min(6, "Mínimo 6 caracteres"),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmNewPassword"],
});

export const updateUserSchema = z.object({
  id: z.string(),
  email: z.string().email("Email inválido").optional(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createClientProfileSchema = z.object({
  userId: z.string(),
  companyName: z.string().optional(),
  monthlyTaskLimit: z.number().int().min(1).default(10),
  revisionLimitPerTask: z.number().int().min(0).default(3),
});

export const createServiceSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  description: z.string().optional(),
  estimatedHours: z.number().int().min(1, "Mínimo 1 hora"),
});

export const updateServiceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  estimatedHours: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const formFieldConfigSchema = z.object({
  serviceId: z.string(),
  fieldName: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, "Solo letras minúsculas, números y guiones bajos"),
  label: z.string().min(1, "Etiqueta requerida"),
  fieldType: z.enum([
    "TEXT",
    "TEXTAREA",
    "NUMBER",
    "SELECT",
    "MULTISELECT",
    "CHECKBOX",
    "COLOR_PICKER",
    "FILE",
    "DATE",
    "URL",
  ]),
  placeholder: z.string().optional(),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});

export const createTaskSchema = z.object({
  serviceId: z.string(),
  title: z.string().min(1, "Título requerido"),
  description: z.string().optional(),
  category: z.enum(["URGENTE", "NORMAL", "LARGO_PLAZO"]),
  formData: z.record(z.unknown()).optional(),
});

export const adminCreateTaskSchema = createTaskSchema.extend({
  clientId: z.string().min(1, "Cliente requerido"),
  colaboradorId: z.string().optional(),
  assignToUserId: z.string().optional(),
  additionalAssignees: z.array(z.string()).optional(),
});

export const updateTaskStatusSchema = z.object({
  taskId: z.string(),
  newStatus: z.enum([
    "RECIBIDA",
    "EN_PROGRESO",
    "DUDA",
    "REVISION",
    "FINALIZADA",
    "CANCELADA",
  ]),
  note: z.string().optional(),
  extraHours: z.number().int().min(0).optional(),
});

export const createServiceSchemaFull = createServiceSchema.extend({
  slaHours: z.number().int().min(1).optional().nullable(),
});

export const updateServiceSchemaFull = updateServiceSchema.extend({
  slaHours: z.number().int().min(1).optional().nullable(),
  agentEnabled: z.boolean().optional(),
  agentInstructions: z.string().optional().nullable(),
  agentModel: z.string().optional().nullable(),
});

export const createCommentSchema = z.object({
  taskId: z.string(),
  content: z.string().min(1, "Comentario requerido"),
  isQuestion: z.boolean().default(false),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
