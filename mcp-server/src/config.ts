import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load environment variables
loadEnv();

// Configuration schema
const ConfigSchema = z.object({
  api: z.object({
    url: z.string().url().default('https://knowledge-server-dev.tabus10.com/api'),
    username: z.string().email(),
    password: z.string().min(1),
    timeout: z.number().default(30000),
    retryAttempts: z.number().default(3),
  }),
  cache: z.object({
    ttl: z.number().default(300), // 5 minutes in seconds
    maxSize: z.number().default(100),
    detailsTtl: z.number().default(600), // 10 minutes for details
  }),
  limits: z.object({
    maxResults: z.number().default(50),
    maxDepth: z.number().default(10),
    maxBulkOperations: z.number().default(100),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// Parse and validate configuration
function loadConfig(): Config {
  const config = {
    api: {
      url: process.env.KNOWLEDGE_API_URL || 'https://knowledge-server-dev.tabus10.com/api',
      username: process.env.KNOWLEDGE_USERNAME || '',
      password: process.env.KNOWLEDGE_PASSWORD || '',
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    },
    cache: {
      ttl: parseInt(process.env.CACHE_TTL || '300'),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100'),
      detailsTtl: parseInt(process.env.CACHE_DETAILS_TTL || '600'),
    },
    limits: {
      maxResults: parseInt(process.env.MAX_RESULTS || '50'),
      maxDepth: parseInt(process.env.MAX_DEPTH || '10'),
      maxBulkOperations: parseInt(process.env.MAX_BULK_OPS || '100'),
    },
    logging: {
      level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    },
  };

  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    console.error('Invalid configuration:', error);
    throw new Error('Failed to load configuration. Check environment variables.');
  }
}

export const config = loadConfig();

// Validate required fields
if (!config.api.username || !config.api.password) {
  throw new Error('KNOWLEDGE_USERNAME and KNOWLEDGE_PASSWORD are required');
}