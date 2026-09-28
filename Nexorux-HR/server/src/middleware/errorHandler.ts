import { Request, Response, NextFunction } from 'express';
import { logger } from '../logs/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function createError(message: string, statusCode: number = 500): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

export function errorHandler(err: Error | AppError, req: Request, res: Response, _next: NextFunction) {
  const appErr = err as AppError;
  const statusCode = appErr.statusCode || 500;
  const isOperational = appErr.isOperational || false;

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    statusCode,
    isOperational,
    requestId: req.requestId,
    tenantId: req.tenantId
  });

  if (!isOperational) {
    res.status(500).json({ error: 'Error interno del servidor' });
    return;
  }

  res.status(statusCode).json({ error: appErr.message });
}
