const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

export function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function monthDates(year, monthIndex) {
  const total = daysInMonth(year, monthIndex);
  return Array.from({ length: total }, (_, index) => formatDate(new Date(Date.UTC(year, monthIndex, index + 1))));
}

export function weekdayIndex(dateString) {
  return parseDate(dateString).getUTCDay();
}

export function isWithinRange(dateString, startDate, endDate) {
  if (startDate && daysBetween(startDate, dateString) < 0) return false;
  if (endDate && daysBetween(dateString, endDate) < 0) return false;
  return true;
}
