import { NextFunction, Request, Response } from 'express';
import { TokenPayload, verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    next(new AppError('Invalid or expired access token', 401, 'INVALID_ACCESS_TOKEN'));
  }
}
