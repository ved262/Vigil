import rateLimit from 'express-rate-limit';
import { AppError } from '../types/index.js';

export const authRatelimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests, please try again later', 429, 'RATE_LIMITED'));
  },
});
