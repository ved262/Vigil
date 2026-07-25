import { NextFunction, Request, Response } from 'express';
import { treeifyError, ZodType } from 'zod';
import { AppError } from '../types/index.js';

export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = treeifyError(result.error).errors;
      next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', details));
      return;
    }
    req.body = result.data;
    next();
  };
}
