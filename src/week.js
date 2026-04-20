/** Shared week-range label so all pages compute the same value. */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmt(d) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Sunday-anchored week label for the given date, e.g. "Apr 14 — Apr 20". */
export function weekLabelForDate(date) {
  const now = date instanceof Date ? new Date(date.getTime()) : new Date();
  const sun = new Date(now);
  sun.setHours(0, 0, 0, 0);
  sun.setDate(now.getDate() - now.getDay());
  const sat = new Date(sun);
  sat.setDate(sun.getDate() + 6);
  return `${fmt(sun)} — ${fmt(sat)}`;
}

export function currentWeekLabel() {
  return weekLabelForDate(new Date());
}

/** ISO-like week id for use as a primary key (year + week number). */
export function weekIdForDate(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  start.setDate(start.getDate() - start.getDay());
  const diffMs = d.getTime() - start.getTime();
  const weekNum = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}
