import {
  getLocalDateIso,
  resolveUserTimezone,
  formatLocalClockTime,
} from './timezone.util';

describe('Timezone Utility (timezone.util)', () => {
  describe('getLocalDateIso', () => {
    it('returns the same calendar date when UTC time is mid-day', () => {
      const date = new Date('2026-11-04T12:00:00Z');
      expect(getLocalDateIso(date, 'Asia/Riyadh')).toBe('2026-11-04');
    });

    it('rolls over to next day when 22:30 UTC lands on 01:30 next morning in Riyadh (UTC+3)', () => {
      const date = new Date('2026-11-04T22:30:00Z');
      expect(getLocalDateIso(date, 'Asia/Riyadh')).toBe('2026-11-05');
    });

    it('rolls over to next day when 20:30 UTC lands on 01:30 next morning in Karachi (UTC+5)', () => {
      const date = new Date('2026-11-04T20:30:00Z');
      expect(getLocalDateIso(date, 'Asia/Karachi')).toBe('2026-11-05');
    });

    it('falls back to Asia/Riyadh when no timezone is specified', () => {
      const date = new Date('2026-11-04T22:30:00Z');
      expect(getLocalDateIso(date)).toBe('2026-11-05');
    });
  });

  describe('resolveUserTimezone', () => {
    it('returns Asia/Karachi for employees with Pakistan or Karachi branch/location', () => {
      expect(resolveUserTimezone({ branch: { city: 'Karachi' } })).toBe('Asia/Karachi');
      expect(resolveUserTimezone({ branch: { name: 'Pakistan Remote Hub' } })).toBe('Asia/Karachi');
    });

    it('returns Asia/Riyadh by default for Saudi branches or missing location', () => {
      expect(resolveUserTimezone({ branch: { city: 'Riyadh' } })).toBe('Asia/Riyadh');
      expect(resolveUserTimezone({ branch: null })).toBe('Asia/Riyadh');
      expect(resolveUserTimezone({})).toBe('Asia/Riyadh');
    });
  });

  describe('formatLocalClockTime', () => {
    it('formats clock time in 12-hour AM/PM string', () => {
      const date = new Date('2026-11-04T06:15:00Z'); // 09:15 AM in Riyadh
      expect(formatLocalClockTime(date, 'Asia/Riyadh')).toBe('09:15 AM');
    });
  });
});
