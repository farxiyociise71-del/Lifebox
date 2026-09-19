import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
  blockedUntil?: number;
}

interface BruteForceRecord {
  failedAttempts: number;
  lastAttemptTime: number;
  lockedUntil?: number;
}

// In-memory buckets
const apiLimits = new Map<string, RateLimitRecord>();
const bruteForceLimits = new Map<string, BruteForceRecord>();

// Cleanup stale memory every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of apiLimits.entries()) {
    if (now - record.firstRequestTime > 15 * 60 * 1000 && (!record.blockedUntil || record.blockedUntil < now)) {
      apiLimits.delete(key);
    }
  }
  for (const [key, record] of bruteForceLimits.entries()) {
    if (now - record.lastAttemptTime > 60 * 60 * 1000 && (!record.lockedUntil || record.lockedUntil < now)) {
      bruteForceLimits.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Standard API rate limiter middleware
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl || req.path}:${clientIp}`;
    const now = Date.now();

    const record = apiLimits.get(key) || { count: 0, firstRequestTime: now };

    if (record.blockedUntil && record.blockedUntil > now) {
      const retryAfterSec = Math.ceil((record.blockedUntil - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Rate limit exceeded. Please wait before retrying.',
        retryAfter: retryAfterSec,
      });
    }

    if (now - record.firstRequestTime > options.windowMs) {
      record.count = 1;
      record.firstRequestTime = now;
      record.blockedUntil = undefined;
    } else {
      record.count += 1;
    }

    if (record.count > options.maxRequests) {
      record.blockedUntil = now + options.windowMs;
      apiLimits.set(key, record);
      const retryAfterSec = Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Rate limit exceeded. Please slow down.',
        retryAfter: retryAfterSec,
      });
    }

    apiLimits.set(key, record);
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.count));
    next();
  };
}

/**
 * Brute force guard for authentication & PIN verification
 * Locks out attacker after 5 failed attempts
 */
export class BruteForceGuard {
  private static MAX_ATTEMPTS = 5;
  private static BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

  private static getKey(identifier: string, req: Request): string {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'ip';
    return `${identifier.toLowerCase().trim()}:${clientIp}`;
  }

  static checkLockout(identifier: string, req: Request): { isLocked: boolean; waitSeconds: number; remainingAttempts: number } {
    const key = this.getKey(identifier, req);
    const now = Date.now();
    const record = bruteForceLimits.get(key);

    if (!record) {
      return { isLocked: false, waitSeconds: 0, remainingAttempts: this.MAX_ATTEMPTS };
    }

    if (record.lockedUntil && record.lockedUntil > now) {
      const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { isLocked: true, waitSeconds, remainingAttempts: 0 };
    }

    // Reset if previous attempts were more than 15 minutes ago
    if (now - record.lastAttemptTime > this.BASE_LOCKOUT_MS) {
      bruteForceLimits.delete(key);
      return { isLocked: false, waitSeconds: 0, remainingAttempts: this.MAX_ATTEMPTS };
    }

    const remaining = Math.max(0, this.MAX_ATTEMPTS - record.failedAttempts);
    return { isLocked: false, waitSeconds: 0, remainingAttempts: remaining };
  }

  static recordFailure(identifier: string, req: Request): { isLocked: boolean; waitSeconds: number; remainingAttempts: number } {
    const key = this.getKey(identifier, req);
    const now = Date.now();
    const record = bruteForceLimits.get(key) || { failedAttempts: 0, lastAttemptTime: now };

    record.failedAttempts += 1;
    record.lastAttemptTime = now;

    if (record.failedAttempts >= this.MAX_ATTEMPTS) {
      // Exponential penalty factor based on repeated lockouts
      const multiplier = Math.min(4, Math.floor(record.failedAttempts / this.MAX_ATTEMPTS));
      record.lockedUntil = now + (this.BASE_LOCKOUT_MS * multiplier);
      bruteForceLimits.set(key, record);
      return {
        isLocked: true,
        waitSeconds: Math.ceil((record.lockedUntil - now) / 1000),
        remainingAttempts: 0,
      };
    }

    bruteForceLimits.set(key, record);
    return {
      isLocked: false,
      waitSeconds: 0,
      remainingAttempts: Math.max(0, this.MAX_ATTEMPTS - record.failedAttempts),
    };
  }

  static recordSuccess(identifier: string, req: Request): void {
    const key = this.getKey(identifier, req);
    bruteForceLimits.delete(key);
  }
}
