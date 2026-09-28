import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err: any) {
      return res.status(400).json({
        error: 'Validation error',
        issues: err.errors?.map((e: any) => ({ path: e.path, message: e.message }))
      });
    }
  };
}
