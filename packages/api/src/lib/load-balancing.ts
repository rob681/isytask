/**
 * Load-balancing helpers for collaborator auto-assignment.
 *
 * Both `Task.colaboradorId` (legacy 1:1) and `TaskAssignment` (N:M) are
 * checked, so old tasks created before dual-write started are still counted.
 * Once `Task.colaboradorId` is removed (Phase D), this collapses to a single
 * `assignments.some` check.
 */

type ActiveStatus =
  | "RECIBIDA"
  | "EN_PROGRESO"
  | "DUDA"
  | "REVISION"
  | "FINALIZADA"
  | "CANCELADA";

const DEFAULT_ACTIVE_STATUSES: ActiveStatus[] = [
  "RECIBIDA",
  "EN_PROGRESO",
  "DUDA",
];

/**
 * Counts active (in-flight) tasks where the colaborador is involved as
 * primary OR helper. COUNT counts unique task rows, so an OR with both
 * legacy + new model never double-counts.
 */
export async function countActiveTasksForColaborador(
  db: any,
  colaboradorId: string,
  statuses: ActiveStatus[] = DEFAULT_ACTIVE_STATUSES
): Promise<number> {
  return db.task.count({
    where: {
      status: { in: statuses },
      OR: [
        { colaboradorId },
        { assignments: { some: { colaboradorId } } },
      ],
    },
  });
}

/**
 * Picks the least busy colaborador from a candidate list. Returns null when
 * the list is empty. Single-element lists short-circuit. Ties are broken by
 * input order, which keeps the behavior deterministic.
 */
export async function pickLeastBusyColaborador(
  db: any,
  candidateColaboradorIds: string[],
  statuses: ActiveStatus[] = DEFAULT_ACTIVE_STATUSES
): Promise<string | null> {
  if (candidateColaboradorIds.length === 0) return null;
  if (candidateColaboradorIds.length === 1) return candidateColaboradorIds[0];

  const counts = await Promise.all(
    candidateColaboradorIds.map(async (id) => ({
      id,
      count: await countActiveTasksForColaborador(db, id, statuses),
    }))
  );

  // Stable sort: ties keep original order (first candidate wins).
  const indexed = counts.map((c, i) => ({ ...c, i }));
  indexed.sort((a, b) => a.count - b.count || a.i - b.i);
  return indexed[0].id;
}

/**
 * Convenience: looks up the colaboradores assigned to a client and picks the
 * least-busy one. Returns null when the client has no collaborators.
 */
export async function autoAssignColaboradorForClient(
  db: any,
  clientId: string,
  statuses?: ActiveStatus[]
): Promise<string | null> {
  const links = await db.colaboradorClientAssignment.findMany({
    where: { clientId },
    select: { colaboradorId: true },
  });
  if (links.length === 0) return null;
  return pickLeastBusyColaborador(
    db,
    links.map((l: { colaboradorId: string }) => l.colaboradorId),
    statuses
  );
}
