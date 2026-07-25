import { NextFunction, Request, Response } from 'express';
import { AppError, ErrorResponseBody } from '../types/index.js';
import 'pino-http';
import { config } from '../config/index.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'Something went wrong';

  req.log?.error({ err, statusCode, code }, 'Request failed');

  const body: ErrorResponseBody = { error: message, code };
  if (isAppError && err.details !== undefined) body.details = err.details;
  if (config.NODE_ENV === 'development' && err instanceof Error) {
    body.details = { ...(body.details as object | undefined), stack: err.stack };
  }
  res.status(statusCode).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ErrorResponseBody = {
    error: `Route: ${req.method} ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
  };
  res.status(404).json(body);
}
