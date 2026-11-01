import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAdminSession,
  getStoredAdminSession,
  isJwtExpired,
  storeAdminSession,
} from '../api/adminSession';
import type { UserSession } from '../api/adminSession';

const makeToken = (exp: number) =>
  `header.${btoa(JSON.stringify({ exp }))}.sig`;

beforeEach(() => {
  sessionStorage.clear();
});

describe('isJwtExpired', () => {
  it('treats malformed tokens as expired', () => {
    expect(isJwtExpired('not-a-token')).toBe(true);
  });

  it('compares the expiry against now', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isJwtExpired(makeToken(now - 10))).toBe(true);
    expect(isJwtExpired(makeToken(now + 600))).toBe(false);
  });
});

describe('getStoredAdminSession', () => {
  const makeSession = (exp: number): UserSession => ({
    token: makeToken(exp),
    user: {
      id: 'user-1',
      employeeId: 'EMP-1',
      firstName: 'Sara',
      lastName: 'Al-Otaibi',
      name: 'Sara Al-Otaibi',
      email: 'sara@macquires.sa',
      role: 'HR_ADMIN',
      department: 'People',
      jobTitle: 'HR Administrator',
      canAccessWebAdmin: true,
    },
  });

  it('returns a valid stored session', () => {
    const now = Math.floor(Date.now() / 1000);
    const session = makeSession(now + 600);
    storeAdminSession(session);
    expect(getStoredAdminSession()?.token).toBe(session.token);
  });

  it('clears and rejects an expired stored session', () => {
    const now = Math.floor(Date.now() / 1000);
    storeAdminSession(makeSession(now - 10));
    expect(getStoredAdminSession()).toBeNull();
    expect(sessionStorage.getItem('macq_admin_session')).toBeNull();
    clearAdminSession();
  });
});
