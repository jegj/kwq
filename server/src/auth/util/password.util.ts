import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const KEY_LENGTH = 64;
const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, derivedKey] = storedHash.split(':');
  if (!salt || !derivedKey) return false;

  const keyBuffer = Buffer.from(derivedKey, 'hex');
  const candidateBuffer = (await scryptAsync(
    password,
    salt,
    KEY_LENGTH,
  )) as Buffer;
  return (
    candidateBuffer.length === keyBuffer.length &&
    timingSafeEqual(candidateBuffer, keyBuffer)
  );
}
