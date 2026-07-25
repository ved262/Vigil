import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

async function bootstarp(): Promise<void> {
  await connectDatabase();
  const app = createApp();

  const server = app.listen(config.PORT, () => {
    logger.info(`Vigil backend listening on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(() => {
      logger.info('Server closed.');
      process.exit(0);
    });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });
}

bootstarp().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
