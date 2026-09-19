import { Router, Request, Response } from 'express';
import { dataStore } from '../data/store';
import { requireAuth } from '../security/authMiddleware';
import { verifyPassword } from '../security/crypto';
import { createRateLimiter } from '../security/rateLimit';

export const privacyRouter = Router();

const privacyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
});

privacyRouter.use(requireAuth, privacyRateLimiter);

/**
 * Data Export: Download comprehensive JSON archive of all user data
 */
privacyRouter.get('/export', (req: Request, res: Response) => {
  const user = req.user!;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';

  const items = dataStore.getUserItems(user.id);
  const collections = dataStore.getUserCollections(user.id);
  const sessions = dataStore.getUserSessions(user.id).map(s => ({
    id: s.id,
    ip: s.ip,
    browser: s.browser,
    os: s.os,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
  }));
  const auditLogs = dataStore.getUserAuditLogs(user.id);

  dataStore.logAuditEvent({
    userId: user.id,
    eventType: 'DATA_EXPORTED',
    ip: clientIp,
    userAgent: req.headers['user-agent'] || 'Unknown',
    details: `Full user data export generated: ${items.length} items, ${collections.length} collections.`,
  });

  const exportBundle = {
    exportDate: new Date().toISOString(),
    schemaVersion: '2.0.0-security-first',
    userProfile: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      privacySettings: {
        isPinProtected: user.isPinProtected,
        isPinRequiredForLocked: user.isPinRequiredForLocked,
        minimizeAiData: user.minimizeAiData,
        aiSummariesEnabled: user.aiSummariesEnabled,
      },
    },
    items,
    collections,
    sessions,
    securityAuditLog: auditLogs,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="lifebox-data-export-${new Date().toISOString().split('T')[0]}.json"`);
  return res.json(exportBundle);
});

/**
 * Update user privacy settings
 */
privacyRouter.post('/settings', (req: Request, res: Response) => {
  const user = req.user!;
  const { minimizeAiData, aiSummariesEnabled, autoOcrEnabled, autoTagEnabled, theme, isPinRequiredForLocked } = req.body;

  if (typeof minimizeAiData === 'boolean') user.minimizeAiData = minimizeAiData;
  if (typeof aiSummariesEnabled === 'boolean') user.aiSummariesEnabled = aiSummariesEnabled;
  if (typeof autoOcrEnabled === 'boolean') user.autoOcrEnabled = autoOcrEnabled;
  if (typeof autoTagEnabled === 'boolean') user.autoTagEnabled = autoTagEnabled;
  if (typeof isPinRequiredForLocked === 'boolean') user.isPinRequiredForLocked = isPinRequiredForLocked;
  if (['light', 'dark', 'system'].includes(theme)) user.theme = theme;

  dataStore.saveUser(user);

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isPinProtected: user.isPinProtected,
      isPinRequiredForLocked: user.isPinRequiredForLocked,
      minimizeAiData: user.minimizeAiData,
      aiSummariesEnabled: user.aiSummariesEnabled,
      theme: user.theme,
    },
  });
});

/**
 * Get user security and audit logs
 */
privacyRouter.get('/audit-log', (req: Request, res: Response) => {
  const user = req.user!;
  const logs = dataStore.getUserAuditLogs(user.id);
  return res.json({ logs });
});

/**
 * Account Deletion ("Right to be Forgotten"): Purges all items, credentials, and sessions
 */
privacyRouter.post('/delete-account', (req: Request, res: Response) => {
  const user = req.user!;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required to confirm account deletion' });
  }

  // Verify password before destructive operation
  const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password. Account deletion aborted for security.' });
  }

  // Completely wipe user data from server
  dataStore.purgeUserData(user.id);

  return res.json({
    success: true,
    message: 'Your account and all associated data, vaults, items, and sessions have been permanently erased.',
  });
});
