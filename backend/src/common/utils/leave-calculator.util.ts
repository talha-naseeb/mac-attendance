import { BadRequestException } from '@nestjs/common';

/**
 * Official Saudi Public Holidays for 2026 Calendar Year
 * Defined in accordance with Saudi Ministry of Human Resources and Social Development (MHRSD)
 */
export const OFFICIAL_SAUDI_HOLIDAYS_2026: Record<string, string> = {
  '2026-02-22': 'Founding Day (يوم التأسيس)',
  '2026-03-20': 'Eid al-Fitr Day 1 (عيد الفطر)',
  '2026-03-21': 'Eid al-Fitr Day 2',
  '2026-03-22': 'Eid al-Fitr Day 3',
  '2026-03-23': 'Eid al-Fitr Day 4',
  '2026-05-26': 'Arafat Day (يوم عرفة)',
  '2026-05-27': 'Eid al-Adha Day 1 (عيد الأضحى)',
  '2026-05-28': 'Eid al-Adha Day 2',
  '2026-05-29': 'Eid al-Adha Day 3',
  '2026-09-23': 'Saudi National Day (اليوم الوطني)',
};

export interface LeaveCalculationParams {
  startDate: Date | string;
  endDate: Date | string;
  country?: 'SA' | 'PK' | string;
  isHalfDay?: boolean;
  halfDayPeriod?: 'MORNING' | 'AFTERNOON' | string;
  extraHolidays?: string[]; // Array of YYYY-MM-DD dates
}

export interface LeaveCalculationResult {
  daysCount: number;
  totalCalendarDays: number;
  workingDaysCount: number;
  weekendDaysCount: number;
  holidayDaysCount: number;
  workingDates: string[];
  weekendDates: string[];
  holidayDates: string[];
}

/**
 * Determines whether a given date is a weekend day based on country schedule.
 * - Saudi Arabia (SA): Friday (5) and Saturday (6)
 * - Pakistan (PK): Saturday (6) and Sunday (0)
 */
export function isWeekendDay(date: Date, country: string = 'SA'): boolean {
  const day = date.getUTCDay();
  if (country === 'PK') {
    return day === 0 || day === 6; // Sunday or Saturday
  }
  // Default SA: Friday or Saturday
  return day === 5 || day === 6;
}

/**
 * Determines whether a given YYYY-MM-DD date is an official public holiday.
 */
export function isPublicHoliday(
  dateIso: string,
  country: string = 'SA',
  extraHolidays: string[] = [],
): boolean {
  if (extraHolidays.includes(dateIso)) {
    return true;
  }
  if (country === 'SA' && OFFICIAL_SAUDI_HOLIDAYS_2026[dateIso]) {
    return true;
  }
  return false;
}

/**
 * Formats a Date object to YYYY-MM-DD string in UTC.
 */
export function toDateIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Accurately calculates billable working days between two dates,
 * excluding official weekends and public holidays, and handling half-day requests.
 */
export function calculateWorkingDays(
  params: LeaveCalculationParams,
): LeaveCalculationResult {
  const start =
    typeof params.startDate === 'string'
      ? new Date(params.startDate)
      : new Date(params.startDate.getTime());
  const end =
    typeof params.endDate === 'string'
      ? new Date(params.endDate)
      : new Date(params.endDate.getTime());

  // Normalize to UTC start of day for accurate calendar day stepping
  const startUtc = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const endUtc = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  );

  if (endUtc < startUtc) {
    throw new BadRequestException('End date cannot precede start date.');
  }

  const country = params.country || 'SA';
  const extraHolidays = params.extraHolidays || [];
  const isHalfDay = Boolean(params.isHalfDay);

  const workingDates: string[] = [];
  const weekendDates: string[] = [];
  const holidayDates: string[] = [];

  const current = new Date(startUtc.getTime());
  let totalCalendarDays = 0;

  while (current <= endUtc) {
    totalCalendarDays++;
    const dateIso = toDateIso(current);

    if (isWeekendDay(current, country)) {
      weekendDates.push(dateIso);
    } else if (isPublicHoliday(dateIso, country, extraHolidays)) {
      holidayDates.push(dateIso);
    } else {
      workingDates.push(dateIso);
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  let workingDaysCount = workingDates.length;
  let daysCount = workingDaysCount;

  if (isHalfDay) {
    if (workingDaysCount > 0) {
      daysCount = 0.5;
      workingDaysCount = 0.5;
    } else {
      daysCount = 0;
      workingDaysCount = 0;
    }
  }

  return {
    daysCount,
    totalCalendarDays,
    workingDaysCount,
    weekendDaysCount: weekendDates.length,
    holidayDaysCount: holidayDates.length,
    workingDates,
    weekendDates,
    holidayDates,
  };
}
