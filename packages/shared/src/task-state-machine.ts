import type { TaskStatus, Role } from "./types";

interface Transition {
  to: TaskStatus[];
  allowedRoles: Role[];
}

const TASK_TRANSITIONS: Record<TaskStatus, Transition[]> = {
  RECIBIDA: [
    { to: ["EN_PROGRESO"], allowedRoles: ["ADMIN", "COLABORADOR"] },
    { to: ["CANCELADA"], allowedRoles: ["ADMIN", "CLIENTE"] },
  ],
  EN_PROGRESO: [
    { to: ["DUDA"], allowedRoles: ["COLABORADOR"] },
    { to: ["REVISION"], allowedRoles: ["ADMIN", "COLABORADOR"] },
    { to: ["FINALIZADA"], allowedRoles: ["ADMIN"] },
    { to: ["CANCELADA"], allowedRoles: ["ADMIN", "CLIENTE"] },
  ],
  DUDA: [
    { to: ["EN_PROGRESO"], allowedRoles: ["ADMIN", "COLABORADOR"] },
    { to: ["CANCELADA"], allowedRoles: ["ADMIN"] },
  ],
  REVISION: [
    { to: ["FINALIZADA"], allowedRoles: ["ADMIN", "CLIENTE"] },
    { to: ["EN_PROGRESO"], allowedRoles: ["ADMIN", "CLIENTE"] },
    { to: ["CANCELADA"], allowedRoles: ["ADMIN"] },
  ],
  FINALIZADA: [
    { to: ["EN_PROGRESO"], allowedRoles: ["ADMIN"] },
  ],
  CANCELADA: [
    { to: ["RECIBIDA"], allowedRoles: ["ADMIN"] },
  ],
};

export function canTransition(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus,
  userRole: Role
): boolean {
  const transitions = TASK_TRANSITIONS[currentStatus];
  return transitions.some(
    (t) => t.to.includes(targetStatus) && t.allowedRoles.includes(userRole)
  );
}

export function getAvailableTransitions(
  currentStatus: TaskStatus,
  userRole: Role
): TaskStatus[] {
  return TASK_TRANSITIONS[currentStatus]
    .filter((t) => t.allowedRoles.includes(userRole))
    .flatMap((t) => t.to);
}
