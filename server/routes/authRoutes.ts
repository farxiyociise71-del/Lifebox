import { Router, Request, Response } from 'express';
import { dataStore, UserRecord } from '../data/store';
import { hashPassword, verifyPassword, hashPin, verifyPin, generateSecureToken } from '../security/crypto';
import { BruteForceGuard, createRateLimiter } from '../security/rateLimit';
import { isValidEmail, validatePassword, sanitizeString } from '../security/sanitizer';
import { requireAuth } from '../security/authMiddleware';

export const authRouter = Router();

// Rate limiters for auth endpoints
const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many authentication attempts. Please wait a moment.',
});

/**
 * Register a new user
 */
authRouter.post('/register', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name, pinCode = '1234' } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.message });
    }

    const existing = dataStore.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists' });
    }

    const pwd = hashPassword(password);
    const pin = hashPin(pinCode);
    const userId = 'user-' + generateSecureToken(8);

    const newUser: UserRecord = {
      id: userId,
      email: email.toLowerCase().trim(),
      name: name ? sanitizeString(name, 50) : '',
      passwordHash: pwd.hash,
      passwordSalt: pwd.salt,
      pinHash: pin.hash,
      pinSalt: pin.salt,
      isPinRequiredForLocked: true,
      isPinProtected: true,
      aiSummariesEnabled: true,
      autoOcrEnabled: true,
      autoTagEnabled: true,
      minimizeAiData: true,
      theme: 'light',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dataStore.saveUser(newUser);

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const session = dataStore.createSession(userId, clientIp, userAgent);

    dataStore.logAuditEvent({
      userId,
      eventType: 'LOGIN',
      ip: clientIp,
      userAgent,
      details: 'User registered and logged in with new session.',
    });

    return res.status(201).json({
      token: session.token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        isPinProtected: newUser.isPinProtected,
        isPinRequiredForLocked: newUser.isPinRequiredForLocked,
        minimizeAiData: newUser.minimizeAiData,
        theme: newUser.theme,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to complete registration' });
  }
});

/**
 * Log in with email and password
 * Enforces brute force lockout and timing-safe password hash check
 */
authRouter.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // 1. Check brute force lockout
    const lockoutCheck = BruteForceGuard.checkLockout(email, req);
    if (lockoutCheck.isLocked) {
      dataStore.logAuditEvent({
        userId: 'unknown',
        eventType: 'FAILED_LOGIN',
        ip: clientIp,
        userAgent,
        details: `Brute force attempt blocked for email ${email}. Locked for ${lockoutCheck.waitSeconds}s.`,
      });
      return res.status(429).json({
        error: 'Account Temporarily Locked',
        message: `Too many failed login attempts. Please try again in ${Math.ceil(lockoutCheck.waitSeconds / 60)} minutes.`,
        retryAfter: lockoutCheck.waitSeconds,
      });
    }

    // 2. Lookup user
    const user = dataStore.getUserByEmail(email);
    if (!user) {
      const failure = BruteForceGuard.recordFailure(email, req);
      return res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Incorrect email or password.',
        remainingAttempts: failure.remainingAttempts,
      });
    }

    // 3. Constant-time password verification
    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      const failure = BruteForceGuard.recordFailure(email, req);
      dataStore.logAuditEvent({
        userId: user.id,
        eventType: 'FAILED_LOGIN',
        ip: clientIp,
        userAgent,
        details: `Failed password attempt for user ${user.email}. Remaining attempts: ${failure.remainingAttempts}`,
      });
      return res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Incorrect email or password.',
        remainingAttempts: failure.remainingAttempts,
      });
    }

    // Successful login: reset brute force counter
    BruteForceGuard.recordSuccess(email, req);

    const session = dataStore.createSession(user.id, clientIp, userAgent);

    dataStore.logAuditEvent({
      userId: user.id,
      eventType: 'LOGIN',
      ip: clientIp,
      userAgent,
      details: 'User successfully logged in via credentials.',
    });

    return res.json({
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPinProtected: user.isPinProtected,
        isPinRequiredForLocked: user.isPinRequiredForLocked,
        minimizeAiData: user.minimizeAiData,
        theme: user.theme,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Authentication service error' });
  }
});

/**
 * Get current authenticated user profile and session info
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const session = req.session!;

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isPinProtected: user.isPinProtected,
      isPinRequiredForLocked: user.isPinRequiredForLocked,
      aiSummariesEnabled: user.aiSummariesEnabled,
      autoOcrEnabled: user.autoOcrEnabled,
      autoTagEnabled: user.autoTagEnabled,
      minimizeAiData: user.minimizeAiData,
      theme: user.theme,
      createdAt: user.createdAt,
    },
    currentSession: {
      id: session.id,
      ip: session.ip,
      browser: session.browser,
      os: session.os,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    },
  });
});

/**
 * Update authenticated user profile
 */
authRouter.put('/profile', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const { name, username, theme, language, timezone } = req.body;

  if (name !== undefined || username !== undefined) {
    user.name = sanitizeString(name || username, 50);
  }
  if (theme !== undefined) {
    user.theme = theme;
  }
  user.updatedAt = new Date().toISOString();
  dataStore.saveUser(user);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.name,
      theme: user.theme,
      language: language || 'English (US)',
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      isPinProtected: user.isPinProtected,
      isPinRequiredForLocked: user.isPinRequiredForLocked,
    },
  });
});

/**
 * Verify PIN code with brute-force protection
 */
authRouter.post('/verify-pin', requireAuth, (req: Request, res: Response) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const user = req.user!;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const lockoutKey = `pin:${user.id}`;

  const lockoutCheck = BruteForceGuard.checkLockout(lockoutKey, req);
  if (lockoutCheck.isLocked) {
    return res.status(429).json({
      error: 'PIN Keypad Locked',
      message: `Too many incorrect PIN attempts. Security lockout active for ${Math.ceil(lockoutCheck.waitSeconds / 60)} minutes.`,
      retryAfter: lockoutCheck.waitSeconds,
    });
  }

  const isValid = verifyPin(String(pin), user.pinHash, user.pinSalt);
  if (!isValid) {
    const failure = BruteForceGuard.recordFailure(lockoutKey, req);
    dataStore.logAuditEvent({
      userId: user.id,
      eventType: 'FAILED_PIN',
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'Unknown',
      details: `Incorrect PIN entered. Remaining attempts: ${failure.remainingAttempts}`,
    });

    return res.status(401).json({
      error: 'Invalid PIN',
      message: 'The PIN code entered is incorrect.',
      remainingAttempts: failure.remainingAttempts,
    });
  }

  BruteForceGuard.recordSuccess(lockoutKey, req);

  dataStore.logAuditEvent({
    userId: user.id,
    eventType: 'PIN_VERIFY',
    ip: clientIp,
    userAgent: req.headers['user-agent'] || 'Unknown',
    details: 'Security PIN successfully verified for vault access.',
  });

  return res.json({ verified: true, message: 'PIN verified successfully' });
});

/**
 * Update user PIN
 */
authRouter.post('/update-pin', requireAuth, (req: Request, res: Response) => {
  const { currentPin, newPin } = req.body;
  const user = req.user!;

  if (!newPin || String(newPin).length < 4 || String(newPin).length > 8) {
    return res.status(400).json({ error: 'New PIN must be between 4 and 8 digits' });
  }

  // If user currently has PIN protection, verify old PIN
  if (user.isPinProtected && currentPin) {
    const isCurrentValid = verifyPin(String(currentPin), user.pinHash, user.pinSalt);
    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }
  }

  const newHashed = hashPin(String(newPin));
  user.pinHash = newHashed.hash;
  user.pinSalt = newHashed.salt;
  user.isPinProtected = true;
  dataStore.saveUser(user);

  dataStore.logAuditEvent({
    userId: user.id,
    eventType: 'PIN_VERIFY',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    details: 'Security PIN updated and re-hashed.',
  });

  return res.json({ success: true, message: 'PIN updated securely' });
});

/**
 * List all active sessions for current user (devices, locations, last active)
 */
authRouter.get('/sessions', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const currentToken = req.token!;
  const sessions = dataStore.getUserSessions(user.id);

  const sanitizedSessions = sessions.map((s) => ({
    id: s.id,
    ip: s.ip,
    browser: s.browser,
    os: s.os,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    isCurrent: s.token === currentToken,
  }));

  return res.json({ sessions: sanitizedSessions });
});

/**
 * Revoke a specific session
 */
authRouter.delete('/sessions/:sessionId', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const { sessionId } = req.params;
  const all = dataStore.getUserSessions(user.id);
  const target = all.find((s) => s.id === sessionId);

  if (!target) {
    return res.status(404).json({ error: 'Session not found or already expired' });
  }

  dataStore.revokeSession(target.token);

  dataStore.logAuditEvent({
    userId: user.id,
    eventType: 'SESSION_REVOKED',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    details: `Session ${target.id} (${target.browser} on ${target.os}) revoked by user.`,
  });

  return res.json({ success: true, message: 'Session revoked successfully' });
});

/**
 * Revoke all other sessions
 */
authRouter.post('/sessions/revoke-others', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const currentToken = req.token!;
  const revokedCount = dataStore.revokeOtherSessions(user.id, currentToken);

  dataStore.logAuditEvent({
    userId: user.id,
    eventType: 'SESSION_REVOKED',
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    details: `Revoked all ${revokedCount} other active sessions.`,
  });

  return res.json({ success: true, revokedCount });
});

/**
 * Logout current session
 */
authRouter.post('/logout', requireAuth, (req: Request, res: Response) => {
  const token = req.token!;
  dataStore.revokeSession(token);
  return res.json({ success: true, message: 'Logged out successfully' });
});
