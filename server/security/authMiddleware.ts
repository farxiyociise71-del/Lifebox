import { Request, Response, NextFunction } from 'express';
import { dataStore, UserRecord, SessionRecord } from '../data/store';

// Extend Express Request interface to include authenticated user and session
declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
      session?: SessionRecord;
      token?: string;
    }
  }
}

/**
 * Require valid authenticated session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Missing or malformed Bearer token.',
    });
  }

  const token = authHeader.substring(7).trim();
  const session = dataStore.getSession(token);

  if (!session) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid, revoked, or expired session. Please log in again.',
    });
  }

  const user = dataStore.getUserById(session.userId);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Associated user account no longer exists.',
    });
  }

  req.user = user;
  req.session = session;
  req.token = token;
  next();
}

/**
 * Optional authentication: attaches user if valid token present, otherwise proceeds
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const session = dataStore.getSession(token);
    if (session) {
      const user = dataStore.getUserById(session.userId);
      if (user) {
        req.user = user;
        req.session = session;
        req.token = token;
      }
    }
  }
  next();
}
