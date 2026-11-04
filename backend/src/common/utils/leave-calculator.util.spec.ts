import {
  calculateWorkingDays,
  isWeekendDay,
  isPublicHoliday,
  OFFICIAL_SAUDI_HOLIDAYS_2026,
} from './leave-calculator.util';

describe('LeaveCalculatorUtil (Phase 9 M5.4 & LV-05 / LV-12)', () => {
  it('TC-LV5.1: Accurately counts regular working days across a Sunday-Thursday Saudi work week', () => {
    // 2026-06-07 (Sunday) to 2026-06-11 (Thursday) -> 5 working days
    const result = calculateWorkingDays({
      startDate: new Date('2026-06-07T00:00:00Z'),
      endDate: new Date('2026-06-11T23:59:59Z'),
      country: 'SA',
    });

    expect(result.daysCount).toBe(5);
    expect(result.totalCalendarDays).toBe(5);
    expect(result.workingDaysCount).toBe(5);
    expect(result.weekendDaysCount).toBe(0);
    expect(result.holidayDaysCount).toBe(0);
  });

  it('TC-LV5.2: Excludes Friday and Saturday weekends for Saudi Arabia (LV-05)', () => {
    // 2026-06-11 (Thursday) to 2026-06-14 (Sunday)
    // Thursday (work), Friday (weekend), Saturday (weekend), Sunday (work) -> 2 working days, 2 weekend days
    const result = calculateWorkingDays({
      startDate: new Date('2026-06-11T00:00:00Z'),
      endDate: new Date('2026-06-14T23:59:59Z'),
      country: 'SA',
    });

    expect(result.totalCalendarDays).toBe(4);
    expect(result.daysCount).toBe(2);
    expect(result.weekendDaysCount).toBe(2);
    expect(result.workingDaysCount).toBe(2);
    expect(result.weekendDates).toContain('2026-06-12'); // Friday
    expect(result.weekendDates).toContain('2026-06-13'); // Saturday
  });

  it('TC-LV5.3: Excludes official Saudi public holidays (Saudi National Day 2026-09-23) (LV-05)', () => {
    // 2026-09-22 (Tuesday) to 2026-09-24 (Thursday)
    // Tuesday (work), Wednesday (National Day Holiday), Thursday (work) -> 2 working days, 1 holiday
    const result = calculateWorkingDays({
      startDate: new Date('2026-09-22T00:00:00Z'),
      endDate: new Date('2026-09-24T23:59:59Z'),
      country: 'SA',
    });

    expect(result.totalCalendarDays).toBe(3);
    expect(result.daysCount).toBe(2);
    expect(result.holidayDaysCount).toBe(1);
    expect(result.holidayDates).toContain('2026-09-23');
  });

  it('TC-LV5.4: Supports custom extra company holidays', () => {
    const customHolidays = ['2026-06-10'];
    const result = calculateWorkingDays({
      startDate: new Date('2026-06-07T00:00:00Z'),
      endDate: new Date('2026-06-11T23:59:59Z'),
      country: 'SA',
      extraHolidays: customHolidays,
    });

    expect(result.daysCount).toBe(4);
    expect(result.holidayDaysCount).toBe(1);
    expect(result.holidayDates).toContain('2026-06-10');
  });

  it('TC-LV12.1: Calculates half-day leave as 0.5 days (LV-12)', () => {
    const result = calculateWorkingDays({
      startDate: new Date('2026-06-08T00:00:00Z'), // Monday
      endDate: new Date('2026-06-08T23:59:59Z'),
      country: 'SA',
      isHalfDay: true,
      halfDayPeriod: 'MORNING',
    });

    expect(result.daysCount).toBe(0.5);
    expect(result.workingDaysCount).toBe(0.5);
    expect(result.totalCalendarDays).toBe(1);
  });

  it('TC-LV12.2: Half-day falling on a weekend produces 0 days', () => {
    const result = calculateWorkingDays({
      startDate: new Date('2026-06-12T00:00:00Z'), // Friday (weekend in SA)
      endDate: new Date('2026-06-12T23:59:59Z'),
      country: 'SA',
      isHalfDay: true,
      halfDayPeriod: 'AFTERNOON',
    });

    expect(result.daysCount).toBe(0);
    expect(result.weekendDaysCount).toBe(1);
  });

  it('TC-LV5.5: Respects Pakistan weekend schedule (Saturday & Sunday)', () => {
    // 2026-06-12 (Friday) to 2026-06-15 (Monday)
    // Friday (work), Saturday (weekend), Sunday (weekend), Monday (work) -> 2 working days, 2 weekend days
    const result = calculateWorkingDays({
      startDate: new Date('2026-06-12T00:00:00Z'),
      endDate: new Date('2026-06-15T23:59:59Z'),
      country: 'PK',
    });

    expect(result.totalCalendarDays).toBe(4);
    expect(result.daysCount).toBe(2);
    expect(result.weekendDaysCount).toBe(2);
    expect(result.weekendDates).toContain('2026-06-13'); // Saturday
    expect(result.weekendDates).toContain('2026-06-14'); // Sunday
  });

  it('TC-LV5.6: Throws error when end date precedes start date', () => {
    expect(() =>
      calculateWorkingDays({
        startDate: new Date('2026-06-15T00:00:00Z'),
        endDate: new Date('2026-06-10T00:00:00Z'),
        country: 'SA',
      }),
    ).toThrow('End date cannot precede start date.');
  });
});
