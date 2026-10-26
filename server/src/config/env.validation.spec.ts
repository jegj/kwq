import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

const SECRET = 'a'.repeat(32);
const baseEnv = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://kwq:kwq@localhost:5432/kwq',
  JWT_SECRET: SECRET,
};

describe('validateEnv', () => {
  it('accepts a minimal production env and fills defaults', () => {
    expect(validateEnv(baseEnv)).toMatchObject({
      APP_ENV: 'production',
      APP_TIMEZONE: 'America/Lima',
      PORT: 3000,
      JWT_SECRET: SECRET,
    });
  });

  it('converts PORT to a number', () => {
    expect(validateEnv({ ...baseEnv, PORT: '8080' }).PORT).toBe(8080);
  });

  it('treats empty strings as unset', () => {
    expect(validateEnv({ ...baseEnv, PUBLIC_URL: '' }).PUBLIC_URL).toBe(
      undefined,
    );
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...env } = baseEnv;
    expect(() => validateEnv(env)).toThrow(/DATABASE_URL/);
  });

  it('rejects an unknown APP_ENV', () => {
    expect(() => validateEnv({ ...baseEnv, APP_ENV: 'prod' })).toThrow(
      /APP_ENV/,
    );
  });

  it('rejects an unknown APP_TIMEZONE', () => {
    expect(() =>
      validateEnv({ ...baseEnv, APP_TIMEZONE: 'Mars/Olympus' }),
    ).toThrow(/APP_TIMEZONE/);
  });

  it('rejects a malformed PUBLIC_URL', () => {
    expect(() => validateEnv({ ...baseEnv, PUBLIC_URL: 'not a url' })).toThrow(
      /PUBLIC_URL/,
    );
  });

  describe('JWT_SECRET', () => {
    it('is required outside development', () => {
      const { JWT_SECRET: _omitted, ...env } = baseEnv;
      expect(() => validateEnv(env)).toThrow(/JWT_SECRET/);
      expect(() => validateEnv({ ...env, APP_ENV: 'staging' })).toThrow(
        /JWT_SECRET/,
      );
    });

    it('must be at least 32 characters outside development', () => {
      expect(() =>
        validateEnv({ ...baseEnv, JWT_SECRET: 'too-short' }),
      ).toThrow(/JWT_SECRET/);
    });

    it('falls back to a dev-only secret in development', () => {
      const env = { ...baseEnv, APP_ENV: 'development', JWT_SECRET: '' };
      expect(validateEnv(env).JWT_SECRET).toBe('dev-only-secret-change-me');
    });

    it('keeps a short explicit secret in development', () => {
      const env = { ...baseEnv, APP_ENV: 'development', JWT_SECRET: 'short' };
      expect(validateEnv(env).JWT_SECRET).toBe('short');
    });
  });

  describe('VAPID keys', () => {
    const vapid = {
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
      VAPID_SUBJECT: 'mailto:admin@kwq.local',
    };

    it('are optional as a group, so push can stay off', () => {
      expect(validateEnv(baseEnv).VAPID_PUBLIC_KEY).toBeUndefined();
    });

    it('accepts the full set', () => {
      expect(validateEnv({ ...baseEnv, ...vapid })).toMatchObject(vapid);
    });

    it.each(Object.keys(vapid))('rejects a set missing %s', (omitted) => {
      const { [omitted]: _omitted, ...partial } = vapid;
      expect(() => validateEnv({ ...baseEnv, ...partial })).toThrow(
        new RegExp(omitted),
      );
    });
  });
});
