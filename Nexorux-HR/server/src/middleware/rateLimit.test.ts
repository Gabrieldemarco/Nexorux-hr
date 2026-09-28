import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimitMiddleware, cleanupRateLimitStore } from '../middleware/rateLimit';

function createRequest(ip: string, url: string) {
  return { ip, originalUrl: url } as any;
}

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    cleanupRateLimitStore();
  });

  it('should allow requests under the limit', () => {
    const middleware = rateLimitMiddleware({ windowMs: 60000, max: 2 });
    const req = createRequest('1.2.3.4', '/test');
    let status: number | undefined;
    const res = {
      set: () => res,
      status: (code: number) => { status = code; return res; },
      json: (body: any) => body
    } as any;
    const next = () => {};

    middleware(req, res, next);
    expect(status).toBeUndefined();
  });

  it('should block requests over the limit', () => {
    const middleware = rateLimitMiddleware({ windowMs: 60000, max: 2, keyExtractor: (req) => `${req.ip}:${req.originalUrl}:block-test` });
    const req = createRequest('1.2.3.4', '/test');
    let status: number | undefined;
    const res = {
      set: () => res,
      status: (code: number) => { status = code; return res; },
      json: (body: any) => body
    } as any;
    const next = () => {};

    middleware(req, res, next);
    expect(status).toBeUndefined();

    middleware(req, res, next);
    expect(status).toBeUndefined();

    middleware(req, res, next);
    expect(status).toBe(429);
  });

  it('should isolate limits by key', () => {
    const middleware = rateLimitMiddleware({ windowMs: 60000, max: 1, keyExtractor: (req) => `${req.ip}:${req.originalUrl}:isolate-test` });
    const req1 = createRequest('1.2.3.4', '/test');
    const req2 = createRequest('5.6.7.8', '/test');
    let status1: number | undefined;
    let status2: number | undefined;
    const res1 = { set: () => res1, status: (code: number) => { status1 = code; return res1; }, json: (body: any) => body } as any;
    const res2 = { set: () => res2, status: (code: number) => { status2 = code; return res2; }, json: (body: any) => body } as any;

    middleware(req1, res1, () => {});
    middleware(req1, res1, () => {});
    middleware(req2, res2, () => {});
    expect(status1).toBe(429);
    expect(status2).toBeUndefined();
  });
});
