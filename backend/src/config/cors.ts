export const DEFAULT_DEVELOPMENT_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

/**
 * Resolves the CORS allowlist.
 *
 * The wildcard is never accepted in production. In development, an explicit
 * list wins; otherwise the local Expo and Vite origins are allowed.
 */
export function resolveCorsOrigins(
  rawOrigins: string | undefined,
  environment: string,
): string[] {
  const origins = (rawOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (environment === 'production') {
    if (origins.length === 0) {
      throw new Error(
        'CORS_ORIGINS must be set to the admin and mobile web origins in production.',
      );
    }
    if (origins.includes('*')) {
      throw new Error('CORS_ORIGINS must not use "*" in production.');
    }
    return origins;
  }

  return origins.length > 0 ? origins : [...DEFAULT_DEVELOPMENT_ORIGINS];
}
