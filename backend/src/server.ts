/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

/**
 * Node Modules
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

/**
 * Custom Modules
 */
import config from 'src/config';
import logger from 'src/lib/logger';
import { connectToData, disconnectFromData } from 'src/lib/mongoose';
/**
 * Router
 */
import v1Router from 'src/router/v1';
import { errorHandler, notFoundHandler } from 'src/middleware/error.middleware';

/**
 * Express app initial
 */
const app = express();

app.use(helmet());
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(config.rateLimit);

if (config.server.nodeEnv !== 'test') {
  app.use(
    morgan('dev', {
      stream: { write: (message: string) => logger.http(message.trim()) },
    }),
  );
}

app.use('/api/v1', v1Router);

app.use(notFoundHandler);
app.use(errorHandler);

(async () => {
  try {
    await connectToData();

    app.listen(config.server.port, () => {
      logger.info('✅ Server is running ....');
      logger.info(`✅ Link-Api: http://localhost:${config.server.port}/api/v1`);
    });
  } catch (error) {
    logger.error('❌ Failed to start the Server', error);

    if (config.server.nodeEnv === 'production') {
      process.exit(1);
    }
  }
})();

const handelServerShutdown = async () => {
  try {
    await disconnectFromData();
    logger.info('【⏻】Shutting down server...');
    process.exit(0);
  } catch (error) {
    logger.error('Error during server shutdown', error);
  }
};

process.on('SIGTERM', handelServerShutdown);
process.on('SIGINT', handelServerShutdown);

export default app;
