import { NextFunction, Request, Response } from 'express';
import { getMe, login, refresh, register } from '../services/auth.service.js';
import { AppError } from '../types/index.js';

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
function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  const result = await register(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ accessToken: result.accessToken, user: result.user });
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  const result = await login(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    throw new AppError('No refresh token provided', 401, 'NO_REFRESH_TOKEN');
  }

  const result = refresh(token);
  res.status(200).json(result);
};

export const logoutUser = (req: Request, res: Response, next: NextFunction) => {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  res.status(200).json({ message: 'Logged out' });
};

export const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  const result = await getMe(req.auth!.userId);
  res.status(200).json(result);
};
