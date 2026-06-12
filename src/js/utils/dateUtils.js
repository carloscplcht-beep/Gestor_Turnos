const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDateUtc(value) {
  const iso = normalizarFechaIso(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function diferenciaDiasUtc(fechaA, fechaB) {
  const timeA = parseIsoDateUtc(fechaA);
  const timeB = parseIsoDateUtc(fechaB);
  if (timeA === null || timeB === null) return NaN;
  return Math.round((timeA - timeB) / DAY_MS);
}

export function parseDate(value) {
  const time = parseIsoDateUtc(value);
  return time === null ? null : new Date(time);
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startDate, endDate) {
  return diferenciaDiasUtc(endDate, startDate);
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

export function esFechaIsoValida(value) {
  return normalizarFechaIso(value) === value;
}

export function normalizarFechaIso(value) {
  if (!value) return "";
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return fechaIsoSiExiste(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const legacyEs = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (legacyEs) return fechaIsoSiExiste(Number(legacyEs[3]), Number(legacyEs[2]), Number(legacyEs[1]));
  return "";
}

function fechaIsoSiExiste(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
