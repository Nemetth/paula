import {
  addDays,
  eachDayOfInterval,
  formatISO,
  isBefore,
  isEqual,
  isWeekend,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

export function toISODate(date: Date): string {
  return formatISO(startOfDay(date), { representation: "date" });
}

export function fromISODate(iso: string): Date {
  return startOfDay(parseISO(iso));
}

/** Business day = not a weekend and not in the blocked set. Weekend definition
 * can be overridden per-client via `workingWeekdays` (defaults to Mon-Sat, since
 * Paula's own capacity template is what really decides free days). */
export function isBusinessDay(
  date: Date,
  blocked: Set<string>,
  workingWeekdays: number[] = [1, 2, 3, 4, 5, 6],
): boolean {
  if (!workingWeekdays.includes(date.getDay())) return false;
  if (blocked.has(toISODate(date))) return false;
  return true;
}

/** Walk backward N business days from `from` (exclusive of `from` itself). */
export function subtractBusinessDays(
  from: Date,
  count: number,
  blocked: Set<string>,
  workingWeekdays?: number[],
): Date {
  let cursor = from;
  let remaining = count;
  while (remaining > 0) {
    cursor = subDays(cursor, 1);
    if (isBusinessDay(cursor, blocked, workingWeekdays)) remaining -= 1;
  }
  return cursor;
}

export function addBusinessDays(
  from: Date,
  count: number,
  blocked: Set<string>,
  workingWeekdays?: number[],
): Date {
  let cursor = from;
  let remaining = count;
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    if (isBusinessDay(cursor, blocked, workingWeekdays)) remaining -= 1;
  }
  return cursor;
}

/** All business days in [start, end], inclusive. */
export function businessDaysInRange(
  start: Date,
  end: Date,
  blocked: Set<string>,
  workingWeekdays?: number[],
): Date[] {
  if (isBefore(end, start)) return [];
  return eachDayOfInterval({ start, end }).filter((d) =>
    isBusinessDay(d, blocked, workingWeekdays),
  );
}

export function sameDay(a: Date, b: Date): boolean {
  return isEqual(startOfDay(a), startOfDay(b));
}

export { addDays, isWeekend, isBefore, startOfDay };
