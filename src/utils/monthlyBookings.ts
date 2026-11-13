import { AdHocBooking } from '../types';

export const MALAYSIA_TIMEZONE = 'Asia/Kuala_Lumpur';

export const MALAY_MONTH_NAMES = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
] as const;

export interface MalaysiaDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dateStr: string; // YYYY-MM-DD
}

export interface CalendarMonthBounds {
  year: number;
  month: number; // 1-12
  startDate: string; // Inclusive: YYYY-MM-01 (00:00 Asia/Kuala_Lumpur)
  endDateExclusive: string; // Exclusive: first day of next month (YYYY-MM-01)
  monthName: string; // e.g. "November"
  monthYearLabel: string; // e.g. "November 2026"
}

/**
 * Extracts calendar date components (year, month, day, YYYY-MM-DD)
 * strictly in Malaysia timezone (Asia/Kuala_Lumpur).
 */
export function getMalaysiaDateParts(reference: Date = new Date()): MalaysiaDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MALAYSIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(reference);
  const year = Number(parts.find((p) => p.type === 'year')?.value || '1970');
  const month = Number(parts.find((p) => p.type === 'month')?.value || '1');
  const day = Number(parts.find((p) => p.type === 'day')?.value || '1');

  const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, dateStr };
}

/**
 * Computes calendar-month boundaries using Malaysia timezone (Asia/Kuala_Lumpur)
 * or an explicit YYYY-MM-DD / YYYY-MM reference string.
 *
 * - Start: First day of current month (inclusive, YYYY-MM-01 00:00 MYT)
 * - End: First day of next month (exclusive, YYYY-MM-01 00:00 MYT)
 */
export function getCalendarMonthBounds(reference: Date | string = new Date()): CalendarMonthBounds {
  let year: number;
  let month: number;

  if (typeof reference === 'string') {
    const match = reference.trim().match(/^(\d{4})-(\d{2})/);
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
    } else {
      const parsed = new Date(reference);
      const parts = getMalaysiaDateParts(isNaN(parsed.getTime()) ? new Date() : parsed);
      year = parts.year;
      month = parts.month;
    }
  } else {
    const parts = getMalaysiaDateParts(reference);
    year = parts.year;
    month = parts.month;
  }

  const mm = String(month).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMm = String(nextMonth).padStart(2, '0');
  const endDateExclusive = `${nextYear}-${nextMm}-01`;

  const monthName = MALAY_MONTH_NAMES[month - 1] || '';
  const monthYearLabel = `${monthName} ${year}`.trim();

  return {
    year,
    month,
    startDate,
    endDateExclusive,
    monthName,
    monthYearLabel,
  };
}

/**
 * Checks whether a YYYY-MM-DD booking date belongs to the given calendar month bounds:
 * startDate <= dateStr < endDateExclusive
 */
export function isDateInCalendarMonth(dateStr: string | undefined, bounds: CalendarMonthBounds): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  return trimmed >= bounds.startDate && trimmed < bounds.endDateExclusive;
}

/**
 * Returns all bookings (any status) belonging to the specified (or current MYT) calendar month.
 * Pure reporting filter: never mutates or deletes records.
 */
export function getBookingsForMonth(
  bookings: AdHocBooking[],
  reference: Date | string = new Date()
): AdHocBooking[] {
  if (!Array.isArray(bookings) || bookings.length === 0) return [];
  const bounds = getCalendarMonthBounds(reference);
  return bookings.filter((b) => b && isDateInCalendarMonth(b.date, bounds));
}

/**
 * Returns confirmed bookings belonging to the specified (or current MYT) calendar month.
 * Pure reporting filter: never mutates or deletes records.
 */
export function getConfirmedBookingsForMonth(
  bookings: AdHocBooking[],
  reference: Date | string = new Date()
): AdHocBooking[] {
  if (!Array.isArray(bookings) || bookings.length === 0) return [];
  const bounds = getCalendarMonthBounds(reference);
  return bookings.filter(
    (b) => b && b.status === 'CONFIRMED' && isDateInCalendarMonth(b.date, bounds)
  );
}

/**
 * Counts confirmed bookings belonging to the specified (or current MYT) calendar month.
 */
export function countConfirmedBookingsForMonth(
  bookings: AdHocBooking[],
  reference: Date | string = new Date()
): number {
  return getConfirmedBookingsForMonth(bookings, reference).length;
}

/**
 * Computes the Firestore query cutoff date (YYYY-MM-DD in Asia/Kuala_Lumpur).
 * Aligns live operational subscriptions to start from the 1st of the current MYT calendar month
 * (preserving future-date conflict detection while excluding prior months unless loaded via archive).
 */
export function getEffectiveBookingLookbackCutoff(
  _lookbackDays: number = 30,
  reference: Date = new Date()
): string {
  return getCalendarMonthBounds(reference).startDate;
}
