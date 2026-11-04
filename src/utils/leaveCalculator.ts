/**
 * Client-side Working Days & Saudi Holiday Calculator for Shiftly Mobile App
 * Mirrors backend leave-calculator.util.ts
 */

import { LeaveType } from '../types/zenhr';

export const LEAVE_TYPES: LeaveType[] = [
  'Annual Vacation',
  'Sick Day off',
  'Sick on file',
  'Hajj Leave',
  'Paternity Leave',
  'Maternity Leave',
  'Marriage Leave',
  'Bereavement Leave',
  'Remote Work',
  'Emergency Leave',
  'Unpaid Leave',
];

export interface WorkingDaysResult {
  calendarDays: number;
  workingDays: number;
  excludedWeekendDays: number;
  excludedHolidayDays: number;
  excludedHolidays: string[];
}

export function isSaudiWeekend(date: Date): boolean {
  const day = date.getDay();
  // 5 = Friday, 6 = Saturday
  return day === 5 || day === 6;
}

export function getSaudiHolidayName(date: Date): string | null {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const year = date.getFullYear();

  // Founding Day: Feb 22
  if (month === 2 && day === 22) {
    return 'Saudi Founding Day';
  }

  // Saudi National Day: Sep 23
  if (month === 9 && day === 23) {
    return 'Saudi National Day';
  }

  // 2026 Eid al-Fitr: Mar 30 - Apr 02
  if (year === 2026 && month === 3 && day >= 30) {
    return 'Eid al-Fitr Holiday';
  }
  if (year === 2026 && month === 4 && day <= 2) {
    return 'Eid al-Fitr Holiday';
  }

  // 2026 Eid al-Adha: Jun 06 - Jun 09
  if (year === 2026 && month === 6 && day >= 6 && day <= 9) {
    return 'Eid al-Adha Holiday';
  }

  return null;
}

export function calculateClientWorkingDays(
  startDateStr: string,
  endDateStr: string,
  isHalfDay: boolean = false,
): WorkingDaysResult {
  if (isHalfDay) {
    return {
      calendarDays: 1,
      workingDays: 0.5,
      excludedWeekendDays: 0,
      excludedHolidayDays: 0,
      excludedHolidays: [],
    };
  }

  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return {
      calendarDays: 0,
      workingDays: 0,
      excludedWeekendDays: 0,
      excludedHolidayDays: 0,
      excludedHolidays: [],
    };
  }

  let calendarDays = 0;
  let workingDays = 0;
  let excludedWeekendDays = 0;
  let excludedHolidayDays = 0;
  const excludedHolidays: string[] = [];

  const curr = new Date(start);
  while (curr <= end) {
    calendarDays++;
    const isWknd = isSaudiWeekend(curr);
    const holidayName = getSaudiHolidayName(curr);

    if (isWknd) {
      excludedWeekendDays++;
    } else if (holidayName) {
      excludedHolidayDays++;
      if (!excludedHolidays.includes(holidayName)) {
        excludedHolidays.push(holidayName);
      }
    } else {
      workingDays++;
    }

    curr.setDate(curr.getDate() + 1);
  }

  return {
    calendarDays,
    workingDays,
    excludedWeekendDays,
    excludedHolidayDays,
    excludedHolidays,
  };
}
