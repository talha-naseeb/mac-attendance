import configuration from './configuration';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('configuration', () => {
  afterEach(restoreEnv);

  it('defaults the API port to 4000', () => {
    delete process.env.PORT;
    process.env.NODE_ENV = 'development';

    expect(configuration().port).toBe(4000);
  });

  it('allows a development fallback in non-production environments', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;

    expect(configuration().jwt.secret.length).toBeGreaterThan(0);
  });

  it('fails fast in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    delete process.env.JWT_SECRET;

    expect(() => configuration()).toThrow(/JWT_SECRET/);
  });

  it('fails fast in production when DATABASE_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(48);
    delete process.env.DATABASE_URL;

    expect(() => configuration()).toThrow(/DATABASE_URL/);
  });

  it('rejects short production secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'too-short';

    expect(() => configuration()).toThrow(/at least 32 characters/);
  });

  it('accepts a complete production configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'a'.repeat(48);

    const config = configuration();

    expect(config.environment).toBe('production');
    expect(config.jwt.secret).toHaveLength(48);
  });

  it('parses TRUST_PROXY into an express-compatible value', () => {
    delete process.env.TRUST_PROXY;
    expect(configuration().security.trustProxy).toBe(false);

    process.env.TRUST_PROXY = 'true';
    expect(configuration().security.trustProxy).toBe(true);

    for (const off of ['false', 'FALSE', 'off', 'no']) {
      process.env.TRUST_PROXY = off;
      expect(configuration().security.trustProxy).toBe(false);
    }

    process.env.TRUST_PROXY = '2';
    expect(configuration().security.trustProxy).toBe(2);

    process.env.TRUST_PROXY = 'loopback, linklocal';
    expect(configuration().security.trustProxy).toBe('loopback, linklocal');
  });

  it('enables Microsoft Entra SSO only for an explicit true flag', () => {
    delete process.env.SSO_ENABLED;
    expect(configuration().sso.enabled).toBe(false);

    process.env.SSO_ENABLED = 'true';
    expect(configuration().sso.enabled).toBe(true);

    process.env.SSO_ENABLED = 'false';
    expect(configuration().sso.enabled).toBe(false);
  });
});
