import 'dotenv/config';
import { z } from 'zod';

/**
 * Every env var the app depends on is declared here, once.
 * If something is missing or malformed, we throw on boot -
 * not three requests later when someone finally hits the
 * code path that needed it.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  REDIS_URL: z.string().optional(),
  APP_VERSION: z.string().default('0.1.0'),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(z.treeifyError(parsed.error).errors);
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
export type AppConfig = typeof config;
