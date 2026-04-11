/**
 * working-hours.ts
 *
 * Utility for calculating dates and durations respecting agency working hours.
 * Uses native Intl API only — no external date libraries required.
 *
 * Data lives in SystemConfig:
 *   key: "business_hours"  → BusinessHoursConfig (per day, multiple blocks)
 *   key: "timezone"        → string (IANA timezone, e.g. "America/Mexico_City")
 */

export interface TimeBlock {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

export interface DayConfig {
  enabled: boolean;
  blocks: TimeBlock[];
}

/** Keyed by day name: "monday", "tuesday", ..., "sunday" */
export type BusinessHoursConfig = Record<string, DayConfig>;

const DAY_SHORT_MAP: Record<string, string> = {
  sun: "sunday",
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
};

/** Default working hours: M-F 9am–6pm */
const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  monday:    { enabled: true,  blocks: [{ start: "09:00", end: "18:00" }] },
  tuesday:   { enabled: true,  blocks: [{ start: "09:00", end: "18:00" }] },
  wednesday: { enabled: true,  blocks: [{ start: "09:00", end: "18:00" }] },
  thursday:  { enabled: true,  blocks: [{ start: "09:00", end: "18:00" }] },
  friday:    { enabled: true,  blocks: [{ start: "09:00", end: "18:00" }] },
  saturday:  { enabled: false, blocks: [] },
  sunday:    { enabled: false, blocks: [] },
};

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/** Parse "HH:mm" → minutes since midnight */
function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// ─── Local time extraction ────────────────────────────────────────────────────

interface LocalParts {
  dayName: string;    // "monday", "tuesday", etc.
  minuteOfDay: number; // 0–1439
}

/**
 * Get the local day name and minute-of-day for a given UTC date in the specified timezone.
 * Uses Intl.DateTimeFormat — no external libraries needed.
 */
function getLocalParts(date: Date, tz: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );

  const shortDay = (parts.weekday ?? "mon").toLowerCase().slice(0, 3);
  const dayName = DAY_SHORT_MAP[shortDay] ?? "monday";

  // hour12: false can return "24" for midnight — normalize it
  const hour = parseInt(parts.hour ?? "0") % 24;
  const minute = parseInt(parts.minute ?? "0");

  return { dayName, minuteOfDay: hour * 60 + minute };
}

// ─── Core check ──────────────────────────────────────────────────────────────

/**
 * Returns true if `date` falls within any working block in the agency's schedule.
 */
export function isWorkingTime(
  date: Date,
  bh: BusinessHoursConfig,
  timezone: string
): boolean {
  const local = getLocalParts(date, timezone);
  const dayConf = bh[local.dayName];
  if (!dayConf?.enabled) return false;

  for (const block of dayConf.blocks) {
    const start = parseTime(block.start);
    const end = parseTime(block.end);
    if (local.minuteOfDay >= start && local.minuteOfDay < end) return true;
  }

  return false;
}

// ─── addWorkingHours ─────────────────────────────────────────────────────────

/**
 * Returns a new date that is `hours` working hours after `startDate`.
 *
 * Algorithm: advance 1 minute at a time, counting only minutes that fall
 * within working blocks. Efficient enough for typical SLA values (8–72h).
 *
 * Safety cap: 365 calendar days max.
 */
export function addWorkingHours(
  startDate: Date,
  hours: number,
  bh: BusinessHoursConfig,
  timezone: string
): Date {
  if (hours <= 0) return new Date(startDate);

  let remaining = Math.round(hours * 60); // convert to minutes
  let current = new Date(startDate);
  const maxSteps = 365 * 24 * 60; // 1 year safety

  for (let i = 0; i < maxSteps && remaining > 0; i++) {
    current = new Date(current.getTime() + 60_000); // +1 minute
    if (isWorkingTime(current, bh, timezone)) {
      remaining--;
    }
  }

  return current;
}

// ─── workingHoursUntilDue ────────────────────────────────────────────────────

/**
 * Returns how many working hours remain between `now` and `dueAt`.
 * Capped at `maxCalendarHours` calendar hours to avoid long loops.
 *
 * Returns 0 if already overdue.
 */
export function workingHoursUntilDue(
  now: Date,
  dueAt: Date,
  bh: BusinessHoursConfig,
  timezone: string,
  maxCalendarHours = 168 // 7 calendar days
): number {
  if (dueAt <= now) return 0;

  const capMs = maxCalendarHours * 60 * 60 * 1000;
  const checkUntil = new Date(Math.min(dueAt.getTime(), now.getTime() + capMs));

  let count = 0;
  let current = new Date(now);

  while (current < checkUntil) {
    current = new Date(current.getTime() + 60_000);
    if (isWorkingTime(current, bh, timezone)) {
      count++;
    }
  }

  return count / 60; // minutes → hours
}

// ─── DB helper ───────────────────────────────────────────────────────────────

export interface WorkingConfig {
  businessHours: BusinessHoursConfig;
  timezone: string;
}

/**
 * Fetch `business_hours` and `timezone` from SystemConfig.
 * Falls back to sensible defaults if not configured.
 */
export async function getWorkingConfig(db: {
  systemConfig: {
    findMany: (args: any) => Promise<Array<{ key: string; value: any }>>;
  };
}): Promise<WorkingConfig> {
  const rows = await db.systemConfig.findMany({
    where: { key: { in: ["business_hours", "timezone"] } },
  });

  const map: Record<string, any> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  return {
    businessHours: (map.business_hours as BusinessHoursConfig) ?? DEFAULT_BUSINESS_HOURS,
    timezone: (map.timezone as string) ?? "America/Mexico_City",
  };
}
