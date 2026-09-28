import { Request, Response, NextFunction } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";
  const connectSrc = isDev ? "'self' ws://localhost:* http://localhost:*" : "'self'";
  const styleSrc = isDev ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline'";

  res.setHeader('Content-Security-Policy', `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; img-src 'self' data: https:; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; font-src 'self' https: data:; object-src 'none'`);

  next();
}
