import { TZDate, tz } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/** Fuso oficial da operação. Tudo é gravado em UTC e exibido neste fuso. */
export const TIMEZONE = "America/Sao_Paulo";
export const inTz = tz(TIMEZONE);
const opts = { in: inTz, weekStartsOn: 0 as const, locale: ptBR };

export function now() {
  return new TZDate(Date.now(), TIMEZONE);
}

export function toTz(date: Date | string | number) {
  return new TZDate(new Date(date).getTime(), TIMEZONE);
}

export const dayStart = (d: Date) => startOfDay(d, opts);
export const dayEnd = (d: Date) => endOfDay(d, opts);
export const weekStart = (d: Date) => startOfWeek(d, opts);
export const weekEnd = (d: Date) => endOfWeek(d, opts);
export const monthStart = (d: Date) => startOfMonth(d, opts);
export const monthEnd = (d: Date) => endOfMonth(d, opts);
export const yearStart = (d: Date) => startOfYear(d, opts);
export const yearEnd = (d: Date) => endOfYear(d, opts);
export const plusDays = (d: Date, n: number) => addDays(d, n, opts);
export const plusWeeks = (d: Date, n: number) => addWeeks(d, n, opts);
export const plusMonths = (d: Date, n: number) => addMonths(d, n, opts);
export const plusYears = (d: Date, n: number) => addYears(d, n, opts);

/** Formata no fuso de São Paulo com locale pt-BR (padrões do date-fns). */
export function fmt(date: Date | string | number, pattern: string) {
  return format(toTz(date), pattern, { locale: ptBR, in: inTz });
}

export const fmtDate = (d: Date | string | number) => fmt(d, "dd/MM/yyyy");
export const fmtShortDate = (d: Date | string | number) => fmt(d, "dd MMM");
export const fmtTime = (d: Date | string | number) => fmt(d, "HH:mm");
export const fmtDateTime = (d: Date | string | number) => fmt(d, "dd/MM/yyyy 'às' HH:mm");
export const fmtMonth = (d: Date | string | number) => fmt(d, "MMMM 'de' yyyy");

/** "2026-10" → início do mês em São Paulo. Valor inválido → mês atual. */
export function parseMonthKey(key: string | null | undefined): Date {
  const m = key?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return monthStart(now());
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return monthStart(now());
  return new TZDate(year, month - 1, 1, TIMEZONE);
}

export function monthKey(d: Date) {
  return fmt(d, "yyyy-MM");
}

/** "2026-10-28" (+ "14:30") em São Paulo → Date (UTC). */
export function parseLocalDateTime(date: string, time?: string | null): Date | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const tm = time ? time.match(/^(\d{2}):(\d{2})$/) : null;
  if (time && !tm) return null;
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])];
  const [h, mi] = tm ? [Number(tm[1]), Number(tm[2])] : [0, 0];
  if (h > 23 || mi > 59) return null;
  const result = new TZDate(y, mo, d, h, mi, TIMEZONE);
  if (result.getMonth() !== mo || result.getDate() !== d) return null;
  return new Date(result.getTime());
}

/** Valores para <input type="date"> e <input type="time"> no fuso de SP. */
export const toDateInput = (d: Date | string | null | undefined) => (d ? fmt(d, "yyyy-MM-dd") : "");
export const toTimeInput = (d: Date | string | null | undefined) => (d ? fmt(d, "HH:mm") : "");

export function isSameDayTz(a: Date, b: Date) {
  return fmt(a, "yyyy-MM-dd") === fmt(b, "yyyy-MM-dd");
}
