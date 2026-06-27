/**
 * ========================================================================
 * Trading Journal - Date Utility Functions
 * ========================================================================
 * 
 * Zentrale date-fns Funktionen für konsistentes Date Handling.
 */

import { 
  format, 
  formatDistanceToNow, 
  parseISO, 
  isToday, 
  isYesterday, 
  startOfWeek, 
  startOfMonth, 
  startOfQuarter, 
  startOfYear, 
  subDays, 
  subMonths, 
  subYears,
  differenceInDays,
  getDay,
  getWeek,
  isSameDay,
  isBefore,
  isAfter,
  isWithinInterval,
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { DATE_FORMATS, LANGUAGES } from '@/shared/config/constants';

// Aktuelle Locale
let currentLocale = de;

export function setDateLocale(lang: string) {
  currentLocale = lang === LANGUAGES.EN ? enUS : de;
}

/**
 * Formatiert ein Datum im ISO-Format (YYYY-MM-DD)
 */
export function formatISO(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, DATE_FORMATS.ISO);
}

/**
 * Formatiert ein Datum für Anzeige (kurz)
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, DATE_FORMATS.DE_SHORT, { locale: currentLocale });
}

/**
 * Formatiert ein Datum für Anzeige (voll mit Wochentag)
 */
export function formatDateFull(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, DATE_FORMATS.DE_FULL, { locale: currentLocale });
}

/**
 * Formatiert Monat und Jahr
 */
export function formatMonthYear(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, DATE_FORMATS.MONTH_YEAR, { locale: currentLocale });
}

/**
 * Formatiert kurz (Tag + Monat)
 */
export function formatShortMonthDay(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, DATE_FORMATS.SHORT_MONTH_DAY, { locale: currentLocale });
}

/**
 * Relative Zeit (z.B. "vor 2 Stunden")
 */
export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: currentLocale });
}

/**
 * Heute Datum als ISO String
 */
export function getToday(): string {
  return formatISO(new Date());
}

/**
 * Prüft ob Datum heute ist
 */
export function checkIsToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isToday(d);
}

/**
 * Prüft ob Datum gestern war
 */
export function checkIsYesterday(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isYesterday(d);
}

/**
 * Start der aktuellen Woche (Montag)
 */
export function getWeekStart(): string {
  return formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }));
}

/**
 * Start des aktuellen Monats
 */
export function getMonthStart(): string {
  return formatISO(startOfMonth(new Date()));
}

/**
 * Start des aktuellen Quartals
 */
export function getQuarterStart(): string {
  return formatISO(startOfQuarter(new Date()));
}

/**
 * Start des aktuellen Jahres
 */
export function getYearStart(): string {
  return formatISO(startOfYear(new Date()));
}

/**
 * Datum vor X Tagen
 */
export function getDaysAgo(days: number): string {
  return formatISO(subDays(new Date(), days));
}

/**
 * Datum vor X Monaten
 */
export function getMonthsAgo(months: number): string {
  return formatISO(subMonths(new Date(), months));
}

/**
 * Datum vor X Jahren
 */
export function getYearsAgo(years: number): string {
  return formatISO(subYears(new Date(), years));
}

/**
 * Differenz in Tagen zwischen zwei Daten
 */
export function getDaysDifference(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return differenceInDays(d1, d2);
}

/**
 * Wochentag (0 = Sonntag, 6 = Samstag)
 */
export function getDayOfWeek(date: Date | string): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return getDay(d);
}

/**
 * Kalenderwoche
 */
export function getWeekNumber(date: Date | string): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return getWeek(d, { weekStartsOn: 1 });
}

/**
 * Prüft ob zwei Daten am gleichen Tag sind
 */
export function areSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isSameDay(d1, d2);
}

/**
 * Prüft ob date1 vor date2 liegt
 */
export function isDateBefore(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isBefore(d1, d2);
}

/**
 * Prüft ob date1 nach date2 liegt
 */
export function isDateAfter(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isAfter(d1, d2);
}

/**
 * Prüft ob Datum in einem Zeitraum liegt
 */
export function isInDateRange(date: Date | string, start: Date | string, end: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  return isWithinInterval(d, { start: s, end: e });
}

/**
 * Date Range für Zeitfilter
 */
export interface DateRange {
  start: string;
  end: string;
}

export function getDateRangeForFilter(filter: string, customRange?: DateRange): DateRange {
  const today = getToday();
  
  switch (filter) {
    case 'today':
      return { start: today, end: today };
    case 'week':
      return { start: getWeekStart(), end: today };
    case 'month':
      return { start: getMonthStart(), end: today };
    case 'quarter':
      return { start: getQuarterStart(), end: today };
    case 'ytd':
      return { start: getYearStart(), end: today };
    case 'year':
      return { start: getYearsAgo(1), end: today };
    case 'custom':
      return customRange || { start: getMonthStart(), end: today };
    case 'all':
    default:
      return { start: '2000-01-01', end: today };
  }
}

export default {
  formatISO,
  formatDateShort,
  formatDateFull,
  formatMonthYear,
  formatShortMonthDay,
  formatRelative,
  getToday,
  checkIsToday,
  checkIsYesterday,
  getWeekStart,
  getMonthStart,
  getQuarterStart,
  getYearStart,
  getDaysAgo,
  getMonthsAgo,
  getYearsAgo,
  getDaysDifference,
  getDayOfWeek,
  getWeekNumber,
  areSameDay,
  isDateBefore,
  isDateAfter,
  isInDateRange,
  getDateRangeForFilter,
  setDateLocale,
};
