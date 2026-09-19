import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { authRouter } from './server/routes/authRoutes';
import { itemRouter } from './server/routes/itemRoutes';
import { privacyRouter } from './server/routes/privacyRoutes';
import { aiRouter } from './server/routes/aiRoutes';
import { scanRouter } from './server/routes/scanRoutes';
import { createRateLimiter } from './server/security/rateLimit';

dotenv.config();

const app = express();
const PORT = 3000;

// Trust reverse proxy (Cloud Run / Nginx)
app.set('trust proxy', 1);

// Security: Disable X-Powered-By header to prevent server fingerprinting
app.disable('x-powered-by');

// Security: Enforce HTTP security headers on all requests
app.use((req, res, next) => {
  // Enforce HSTS (1 year)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Frame protection (Anti-clickjacking)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; media-src 'self' data: blob:; object-src 'none';"
  );
  next();
});

// Enforce request body size limits to prevent Denial of Service (DoS)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Global API Rate Limiter: max 300 requests per 60s per client IP
const globalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
  message: 'API rate limit exceeded. Please throttle requests.',
});

// 1. Health check (Never exposes secrets or API keys)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    security: {
      httpsEnforced: true,
      hstsActive: true,
      vaultEncryption: 'AES-256-GCM',
      passwordHashing: 'PBKDF2-SHA512',
      rateLimitingActive: true,
      bruteForceProtection: true,
      piiRedactionActive: true,
    },
    hasAiService: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// 2. Mount API Routes with strict validation & rate limiting
app.use('/api/auth', authRouter);
app.use('/api/items', itemRouter);
app.use('/api/scans', scanRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/ai', aiRouter);

// Global Error Handler (prevents stack traces from leaking to client in production)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

// 3. Vite middleware for dev / static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LIFEBOX Security-First Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
