import * as argon2 from 'argon2';

/**
 * Password Security Utility
 * Uses Argon2id (OWASP recommended) for memory-hard, GPU-resistant password hashing.
 * Automatic random salt generation is handled securely by Argon2.
 */

/**
 * Hashes a plaintext password using Argon2id.
 * Plaintext passwords are never logged or stored.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB memory
    timeCost: 3,         // 3 iterations
    parallelism: 1,      // 1 lane
  });
}

/**
 * Verifies a plaintext password against an existing Argon2 hash using constant-time comparison.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || !passwordHash) {
    return false;
  }

  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    // If the hash is malformed or invalid, verification fails safely
    return false;
  }
}
