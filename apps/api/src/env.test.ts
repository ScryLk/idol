import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://idol:idol@localhost:5432/idol',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
};

describe('loadEnv', () => {
  it('aceita env válida e coage tipos', () => {
    const env = loadEnv(validEnv);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('test');
    expect(env.HOST).toBe('0.0.0.0');
  });

  it('falha rápido sem DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('falha rápido com JWT_SECRET curto', () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: 'curto' })).toThrow(/JWT_SECRET/);
  });

  it('rejeita DATABASE_URL que não é postgres', () => {
    expect(() => loadEnv({ ...validEnv, DATABASE_URL: 'mysql://x:y@z:3306/db' })).toThrow();
  });

  it('rejeita porta inválida', () => {
    expect(() => loadEnv({ ...validEnv, PORT: '0' })).toThrow(/PORT/);
    expect(() => loadEnv({ ...validEnv, PORT: 'abc' })).toThrow(/PORT/);
  });
});
