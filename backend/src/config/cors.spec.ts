import { DEFAULT_DEVELOPMENT_ORIGINS, resolveCorsOrigins } from './cors';

describe('resolveCorsOrigins', () => {
  it('uses local Expo and Vite origins in development', () => {
    expect(resolveCorsOrigins(undefined, 'development')).toEqual(
      DEFAULT_DEVELOPMENT_ORIGINS,
    );
  });

  it('prefers an explicit development allowlist', () => {
    expect(
      resolveCorsOrigins('http://localhost:5173, http://localhost:8081', 'development'),
    ).toEqual(['http://localhost:5173', 'http://localhost:8081']);
  });

  it('rejects a missing production allowlist', () => {
    expect(() => resolveCorsOrigins(undefined, 'production')).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('rejects the wildcard in production', () => {
    expect(() => resolveCorsOrigins('*', 'production')).toThrow(/wildcard|"\*"/);
  });

  it('accepts an explicit production allowlist', () => {
    expect(
      resolveCorsOrigins('https://admin.macquires.sa', 'production'),
    ).toEqual(['https://admin.macquires.sa']);
  });
});
