/**
 * Frontend helpers for reading task assignment data during the dual-write
 * period. Tasks have both `colaborador` (legacy 1:1) and `assignments` (N:M).
 * Prefer the new model; fall back to legacy for tasks created before the
 * dual-write started. When Phase D drops the legacy column, this collapses
 * to just the assignments lookup.
 */

type AssignmentLike = {
  role: string;
  colaborador: { user: { name: string | null } };
};

type LegacyColaboradorLike = {
  user: { name: string | null };
} | null;

type TaskLike = {
  colaborador?: LegacyColaboradorLike;
  assignments?: AssignmentLike[];
};

/**
 * Returns the primary assignee's display name, or "Sin asignar" when the
 * task has no assignee in either model.
 */
export function getPrimaryAssigneeName(task: TaskLike): string {
  const primary = task.assignments?.find((a) => a.role === "PRIMARY");
  return (
    primary?.colaborador.user.name ??
    task.colaborador?.user.name ??
    "Sin asignar"
  );
}

/**
 * Returns true when the task has at least one assignee (primary or helper)
 * in either the new or legacy model.
 */
export function hasAnyAssignee(task: TaskLike): boolean {
  if (task.assignments && task.assignments.length > 0) return true;
  return Boolean(task.colaborador);
}
