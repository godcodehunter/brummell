import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;

const sessions = new Set<string>();

export function prepaireForStorage(password: string): { password_hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const password_hash = hashPassword(password, salt);
  return { password_hash, salt };
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
}

export function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  const computed = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHex, "hex");
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

export function issueToken(): string {
  const token = randomBytes(32).toString("hex");
  sessions.add(token);
  return token;
}

export function isValidToken(token: string): boolean {
  return sessions.has(token);
}