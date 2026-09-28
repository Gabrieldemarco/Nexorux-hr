import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function rateLimitMiddleware(options: { windowMs: number; max: number; keyExtractor?: (req: Request) => string }) {
  const { windowMs, max, keyExtractor } = options;
  const getKey = keyExtractor || ((req: Request) => `${req.ip}:${req.originalUrl}`);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getKey(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
    }

    next();
  };
}

export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}
