const DEV_JWT_SECRET = 'macqhr-local-development-only-secret-change-me';
const DEV_DATABASE_URL =
  'postgresql://macqhr_user:secure_password@localhost:5432/macqhr_db?schema=public';

function resolveRequiredValue(
  name: string,
  value: string | undefined,
  devFallback: string,
  environment: string,
): string {
  const normalized = value?.trim() ?? '';

  if (normalized.length > 0) {
    return normalized;
  }

  if (environment === 'production') {
    throw new Error(
      `${name} must be set in production. Refusing to start with a development default.`,
    );
  }

  return devFallback;
}

export interface AppConfig {
  port: number;
  environment: string;
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  security: {
    defaultGeofenceRadiusMeters: number;
    maxAllowedGpsAccuracyMeters: number;
    maxAllowedNtpDriftMinutes: number;
  };
  saudiLabor: {
    gosiEmployeeRate: number;
    gosiEmployerRate: number;
  };
  azure: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  };
  auth: {
    accessTokenTtl: string;
    refreshTokenDays: number;
    absoluteSessionHours: number;
    superAdminAbsoluteSessionHours: number;
    maxFailedLogins: number;
    lockoutMinutes: number;
  };
  sso: {
    enabled: boolean;
  };
}

export default (): AppConfig => {
  const environment = process.env.NODE_ENV || 'development';
  const jwtSecret = resolveRequiredValue(
    'JWT_SECRET',
    process.env.JWT_SECRET,
    DEV_JWT_SECRET,
    environment,
  );

  if (environment === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }

  return {
    port: parseInt(process.env.PORT || '4000', 10),
    environment,
    databaseUrl: resolveRequiredValue(
      'DATABASE_URL',
      process.env.DATABASE_URL,
      DEV_DATABASE_URL,
      environment,
    ),
    jwt: {
      secret: jwtSecret,
      expiresIn: process.env.JWT_EXPIRATION || '24h',
    },
    security: {
      defaultGeofenceRadiusMeters: parseFloat(
        process.env.DEFAULT_GEOFENCE_RADIUS_METERS || '150',
      ),
      maxAllowedGpsAccuracyMeters: parseFloat(
        process.env.MAX_ALLOWED_GPS_ACCURACY_METERS || '50',
      ),
      maxAllowedNtpDriftMinutes: parseFloat(
        process.env.MAX_ALLOWED_NTP_DRIFT_MINUTES || '5',
      ),
    },
    saudiLabor: {
      gosiEmployeeRate: parseFloat(
        process.env.SAUDI_GOSI_EMPLOYEE_RATE || '0.0975',
      ),
      gosiEmployerRate: parseFloat(
        process.env.SAUDI_GOSI_EMPLOYER_RATE || '0.1175',
      ),
    },
    azure: {
      tenantId: process.env.AZURE_TENANT_ID || '',
      clientId: process.env.AZURE_CLIENT_ID || '',
      clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    },
    auth: {
      accessTokenTtl: process.env.JWT_ACCESS_EXPIRATION || '15m',
      refreshTokenDays: parseInt(process.env.REFRESH_TOKEN_DAYS || '7', 10),
      absoluteSessionHours: parseInt(process.env.SESSION_ABSOLUTE_HOURS || '720', 10),
      superAdminAbsoluteSessionHours: parseInt(process.env.SUPER_ADMIN_SESSION_HOURS || '8', 10),
      maxFailedLogins: parseInt(process.env.MAX_FAILED_LOGINS || '5', 10),
      lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES || '15', 10),
    },
    sso: {
      enabled: process.env.SSO_ENABLED === 'true',
    },
  };
};
