import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  getMeController,
} from '../controllers/auth.controller.js';

const router = Router();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  workspaceName: z.string().min(2).max(50),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

router.post('/register', authRateLimiter, validate(registerSchema), asyncHandler(registerController));
router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(loginController));
router.post('/refresh', refreshController);
router.post('/logout', logoutController);
router.get('/me', requireAuth, asyncHandler(getMeController));

export { router as authRouter };