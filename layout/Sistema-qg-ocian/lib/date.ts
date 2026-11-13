/** Datas do sistema: o "dia" da lanchonete segue o fuso de São Paulo e é guardado como "YYYY-MM-DD". */
export const TIMEZONE = "America/Sao_Paulo";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Dia atual (YYYY-MM-DD) no fuso de São Paulo. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Soma (ou subtrai) dias de uma chave YYYY-MM-DD. */
export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lista de chaves de `from` até `to` (inclusive). */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

function keyToDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

/** "Quinta-feira, 13 de novembro" */
export function formatLongDate(key: string): string {
  const s = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(keyToDate(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "13/11" */
export function formatShortDate(key: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(
    keyToDate(key),
  );
}

/** "qui, 13/11" */
export function formatWeekdayShort(key: string): string {
  const wd = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" })
    .format(keyToDate(key))
    .replace(".", "");
  return `${wd}, ${formatShortDate(key)}`;
}

/** Hora "18:32" de um ISO no fuso de São Paulo. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}
