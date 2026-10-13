import crypto from 'node:crypto';
import { env } from '../../config/env';
import { GitHubNotConfiguredError } from './github.errors';

export interface EncryptedPayload {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * Resolves the 32-byte AES-256 encryption key from the environment.
 * Accepts either a 64-character hex string or a 32-byte string.
 */
function getEncryptionKey(): Buffer {
  const rawKey = env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new GitHubNotConfiguredError(
      'GITHUB_TOKEN_ENCRYPTION_KEY is not configured. Access tokens cannot be encrypted or decrypted.'
    );
  }

  // If 64 hex characters, parse as hex
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  // If exactly 32 bytes
  const buf = Buffer.from(rawKey, 'utf8');
  if (buf.length === 32) {
    return buf;
  }

  // Derive a deterministic 32-byte key via sha256 to ensure exactly 256 bits
  return crypto.createHash('sha256').update(buf).digest();
}

/**
 * Encrypts sensitive text (e.g. GitHub OAuth Access Token) at rest using AES-256-GCM.
 * Generates a cryptographically random 12-byte IV and a 16-byte authentication tag.
 */
export function encryptToken(plainText: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypts sensitive text from rest using AES-256-GCM.
 * Validates the authentication tag to ensure authenticity and prevent tampering.
 */
export function decryptToken(payload: EncryptedPayload): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const encrypted = Buffer.from(payload.encrypted, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
