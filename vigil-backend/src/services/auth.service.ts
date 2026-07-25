import { UserModel } from '../models/Users.js';
import { WorkspaceModel } from '../models/Workspace.js';
import { AppError } from '../types/index.js';
import bcrypt from 'bcrypt';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import mongoose from 'mongoose';

const BCRYPT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  password: string;
  workspaceName: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    workspaceId: string;
    role: string;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

async function generateUniqueSlug(workspaceName: string) {
  const base = workspaceName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  let slug = base;
  let attempt = 0;
  while (await WorkspaceModel.exists({ slug })) {
    attempt++;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 5) {
      throw new AppError(
        'Could not generate a unique workspace slug',
        500,
        'SLUG_GENERATION_FAILED',
      );
    }
  }
  return slug;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await UserModel.exists({ email: input.email });
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const slug = await generateUniqueSlug(input.workspaceName);
  const session = await mongoose.startSession();
  let user: any;
  let workspace: any;

  try {
    await session.withTransaction(async () => {
      const [createdWorkspace] = await WorkspaceModel.create(
        [{ name: input.workspaceName, slug, ownerId: undefined }],
        { session },
      );

      if (!createdWorkspace) {
        throw new AppError('Failed to create workspace', 500, 'WORKSPACE_CREATION_FAILED');
      }

      const [createdUser] = await UserModel.create(
        [{ email: input.email, passwordHash, workspaceId: createdWorkspace._id, role: 'owner' }],
        { session },
      );

      if (!createdUser) {
        throw new AppError('Failed to create user', 500, 'USER_CREATION_FAILED');
      }

      createdWorkspace.ownerId = createdUser._id;
      await createdWorkspace.save({ session });

      workspace = createdWorkspace;
      user = createdUser;
    });
  } finally {
    await session.endSession();
  }

  const payload = { userId: user._id.toString(), workspaceId: workspace._id.toString() };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: input.email,
      workspaceId: workspace._id.toString(),
      role: user.role,
    },
  };
}

export async function login(input: LoginInput) {
  const user = await UserModel.findOne({ email: input.email });
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const payload = { userId: user._id.toString(), workspaceId: user.workspaceId.toString() };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      workspaceId: user.workspaceId.toString(),
      role: user.role,
    },
  };
}
