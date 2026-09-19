import crypto from 'node:crypto';

// Server master encryption key (derived from env or persistent server secret)
const SERVER_SECRET = process.env.ENCRYPTION_SECRET || process.env.APP_SECRET || 'lifebox-secure-master-key-seed-32bytes!';
const SERVER_KEY = crypto.scryptSync(SERVER_SECRET, 'lifebox-static-salt', 32);

/**
 * Hash password using PBKDF2-SHA512 with a unique 16-byte random salt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify password against stored hash and salt using constant-time comparison
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Hash user 4-digit or 6-digit PIN securely
 */
export function hashPin(pin: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify PIN securely with constant-time equality
 */
export function verifyPin(pin: string, storedHash: string, salt: string): boolean {
  try {
    const computedHash = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Derive user-specific 256-bit vault encryption key
 */
export function deriveUserVaultKey(userSecret: string, userSalt: string): Buffer {
  return crypto.pbkdf2Sync(userSecret, userSalt, 100000, 32, 'sha256');
}

/**
 * Authenticated Encryption (AES-256-GCM)
 * Encrypts sensitive plaintext payload with a derived key or server key
 */
export function encryptVaultData(
  plaintext: string,
  key: Buffer = SERVER_KEY
): { iv: string; ciphertext: string; authTag: string } {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted,
    authTag,
  };
}

/**
 * Authenticated Decryption (AES-256-GCM)
 * Verifies authenticity and decrypts ciphertext. Throws if tampered with.
 */
export function decryptVaultData(
  encrypted: { iv: string; ciphertext: string; authTag: string },
  key: Buffer = SERVER_KEY
): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encrypted.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

  let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate cryptographically secure random token (session token, API token)
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
