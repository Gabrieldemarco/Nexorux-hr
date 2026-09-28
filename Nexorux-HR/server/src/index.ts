import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import dotenv from 'dotenv';
import { seedDatabase } from './seeds/seed';
import { initDatabase } from './config/db';
import { apiRouter } from './routes/api';
import { systemRouter } from './routes/system';
import { WebhookService } from './services/WebhookService';
import { requestIdMiddleware } from './middleware/context';
import { cleanupRateLimitStore } from './middleware/rateLimit';
import { csrfMiddleware } from './middleware/csrf';
import { securityHeaders } from './middleware/securityHeaders';
import { errorHandler } from './middleware/errorHandler';
import { db } from './config/db';
import { logger } from './logs/logger';
import { setupSwagger } from './config/swagger';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const shouldSeed = !isProduction && process.env.SEED_DATABASE !== 'false';

if (shouldSeed) {
  seedDatabase();
} else {
  initDatabase();
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(requestIdMiddleware);

app.use(compression());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      tenantId: req.tenantId,
      userId: req.user?.id,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
  });
  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    return next();
  }

  const publicPaths = [
    '/api/v1/auth/login',
    '/api/v1/auth/csrf-token',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/system/health',
    '/system/status'
  ];
  const isPublicPath = publicPaths.includes(req.originalUrl.split('?')[0]);

  const tenantId = req.headers['x-tenant-id'] as string;
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID, X-Request-ID, X-XSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(204);
  }

  if (!tenantId && !isPublicPath) {
    logger.warn('CORS request missing X-Tenant-ID header', {
      origin,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip
    });
    return res.status(400).json({ error: 'X-Tenant-ID header is required for CORS validation' });
  }

  let allowedOrigins = '';
  try {
    const tenant = db.prepare('SELECT allowed_origins FROM tenants WHERE id = ?').get(tenantId) as { allowed_origins: string | null } | undefined;
    allowedOrigins = tenant?.allowed_origins || '';
  } catch (err) {
    allowedOrigins = '';
  }

  if (allowedOrigins && (allowedOrigins === '*' || allowedOrigins.split(',').map(o => o.trim()).includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID, X-Request-ID, X-XSRF-Token');
    res.setHeader('Access-Control-Expose-Headers', 'X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  next();
});

app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());
app.use(securityHeaders);
app.use(csrfMiddleware);

app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

app.use(systemRouter());

setupSwagger(app);

app.use('/api/v1', apiRouter);

app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info('NEXORUX HR Backend API started', { port: PORT });
});

setInterval(() => {
  try {
    WebhookService.processPendingDeliveries();
  } catch (err) {
    logger.error('Webhook retry processor error', { error: err });
  }
}, 15000);

setInterval(() => {
  cleanupRateLimitStore();
}, 5 * 60 * 1000);

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
