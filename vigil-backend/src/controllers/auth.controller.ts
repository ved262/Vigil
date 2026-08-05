import type { Request, Response } from 'express';
import { config } from '../config/index.js';
import { AppError } from '../types/index.js';
import { register, login, refresh, getMe } from '../services/auth.service.js';

/**
 * httpOnly: JS on the frontend can never read this cookie - the main
 * defense against XSS stealing the refresh token.
 * secure: only sent over HTTPS - disabled in dev since localhost is
 * plain HTTP, enforced in production.
 * sameSite: 'strict' - browser won't send this cookie on cross-site
 * requests at all, a meaningful CSRF defense for free.
 * path: scoped to just the refresh endpoint - the cookie isn't even
 * sent on unrelated API calls, shrinking its exposure window.
 */
function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function registerController(req: Request, res: Response): Promise<void> {
  const result = await register(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ accessToken: result.accessToken, user: result.user });
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const result = await login(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
}

export function refreshController(req: Request, res: Response): void {
  const token = req.cookies?.refreshToken;
  if (!token) {
    throw new AppError('No refresh token provided', 401, 'NO_REFRESH_TOKEN');
  }
  const result = refresh(token);
  res.status(200).json(result);
}

export function logoutController(_req: Request, res: Response): void {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  res.status(200).json({ message: 'Logged out' });
}

export async function getMeController(req: Request, res: Response): Promise<void> {
  const result = await getMe(req.auth!.userId);
  res.status(200).json(result);
}
