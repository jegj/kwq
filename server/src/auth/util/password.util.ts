import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, derivedKey] = storedHash.split(':');
  const keyBuffer = Buffer.from(derivedKey, 'hex');
  const candidateBuffer = scryptSync(password, salt, KEY_LENGTH);
  return (
    candidateBuffer.length === keyBuffer.length &&
    timingSafeEqual(candidateBuffer, keyBuffer)
  );
}
