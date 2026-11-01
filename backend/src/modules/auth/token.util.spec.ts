import {
  formatRefreshToken,
  hashRefreshSecret,
  parseRefreshToken,
  refreshTokenMatches,
} from './token.util';

describe('token.util', () => {
  it('formats and parses a sessionId.secret pair', () => {
    const token = formatRefreshToken('session-1', 'abc123');
    expect(token).toBe('session-1.abc123');
    expect(parseRefreshToken(token)).toEqual({ sessionId: 'session-1', secret: 'abc123' });
  });

  it('rejects malformed tokens', () => {
    expect(parseRefreshToken('no-dot')).toBeNull();
    expect(parseRefreshToken('.missing')).toBeNull();
    expect(parseRefreshToken('missing.')).toBeNull();
  });

  it('hashes deterministically and compares in constant time', () => {
    const hash = hashRefreshSecret('super-secret');
    expect(refreshTokenMatches('super-secret', hash)).toBe(true);
    expect(refreshTokenMatches('other-secret', hash)).toBe(false);
  });
});
