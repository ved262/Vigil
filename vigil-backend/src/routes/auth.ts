import { Router, Response } from 'express';
import { z } from 'zod';
import { authRatelimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerUser,
  loginUser,
  refreshToken,
  getUserProfile,
  logoutUser,
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

router.post('/register', authRatelimiter, validate(registerSchema), asyncHandler(registerUser));
router.post('/login', authRatelimiter, validate(loginSchema), asyncHandler(loginUser));
router.post('/refresh', asyncHandler(refreshToken));
router.post('/logout', logoutUser);
router.get('/me', asyncHandler(getUserProfile));

export { router as authRouter };
