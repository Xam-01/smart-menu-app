/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

/**
 * Node Modules
 */
import mongoose from 'mongoose';
/**
 * Custom Modules
 */
import config from 'src/config';
import logger from 'src/lib/logger';
/**
 * Types
 */
import type { ConnectOptions } from 'mongoose';

const connectOptions: ConnectOptions = {
  dbName: 'smartmenu',
  appName: 'SmartMenu API',
  serverSelectionTimeoutMS: 5000,
};

const connectToData = async (): Promise<void> => {
  if (!config.db.uri) {
    throw new Error('MONGOOSE_URL is not set in environment variables');
  }

  try {
    await mongoose.connect(config.db.uri, connectOptions);
    logger.info('✅ Connected to MongoDB successfully.', {
      url: config.db.uri,
      option: connectOptions,
    });
  } catch (err) {
    if (err instanceof Error) {
      console.error('❌ Failed to connect to MongoDB:', err.message);
      throw err;
    }
    logger.error('❌ Failed to connect to MongoDB:', err);
  }
};

const disconnectFromData = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('✅ Disconnect the database successfully', {
      url: config.db.uri,
      option: connectOptions,
    });
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(err.message);
    }

    logger.error('⚠️ Error disconnect from the database.', err);
  }
};

export { connectToData, disconnectFromData };
