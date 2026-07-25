import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

/**
 * Connects to MongoDB on boot. Mongoose retries internally against
 * serverSelectionTimeoutMS before giving up - we don't hand-roll our
 * own retry loop on top of that. If it can't connect within that
 * window, it's very likely a real misconfiguration (bad URI, wrong
 * credentials, IP not whitelisted in Atlas) rather than a transient
 * blip, so we exit and let the process manager restart us once the
 * actual problem is fixed - crash-looping against a bad config
 * forever is worse than failing fast with a clear log line.
 */
export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected.');
  });

  mongoose.connection.on('error', () => {
    logger.error('MongoDB connection error.');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  try {
    mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  } catch (err) {
    logger.error({ err }, 'Failed to connect to MongoDB on boot - exiting');
    process.exit(1);
  }
}

/**
 * Used by /health to report real connection state rather than assuming
 * "the process is up" means "the database is reachable" - those are
 * genuinely different things and a monitoring system needs to know which
 * one it's looking at.
 */
export function getDatabaseStatus(): 'connected' | 'connecting' | 'disconnected' {
  const state = mongoose.connection.readyState;
  if (state === 1) return 'connected';
  else if (state === 2) return 'connecting';
  return 'disconnected';
}
