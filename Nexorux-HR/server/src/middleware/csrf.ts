import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-xsrf-token';
const CSRF_SECRET = process.env.CSRF_SECRET;
if (process.env.NODE_ENV === 'production' && !CSRF_SECRET) {
  throw new Error('CSRF_SECRET debe estar configurado en producción');
}
const csrfSecret = CSRF_SECRET || 'dev-only-csrf-secret-do-not-use-in-production';

function signToken(token: string): string {
  return crypto.createHmac('sha256', csrfSecret).update(token).digest('hex');
}

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method;
  const path = req.originalUrl.split('?')[0];

  const exemptPaths = ['/health', '/auth/login', '/auth/forgot-password', '/auth/reset-password', '/ai/query'];

  const normalizedPath = path.startsWith('/api/v1') ? path.slice('/api/v1'.length) || '/' : path;

  if (exemptPaths.includes(normalizedPath)) {
    return next();
  }

  const stateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  if (!stateChanging) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  const bodyToken = (req.body && req.body._csrf) as string | undefined;
  const providedToken = headerToken || bodyToken;

  if (!cookieToken || !providedToken || signToken(cookieToken) !== providedToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

export function setCsrfCookie(req: Request, res: Response) {
  const token = crypto.randomBytes(32).toString('hex');
  const signed = signToken(token);

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  });

  res.setHeader('X-CSRF-Token', signed);
}
