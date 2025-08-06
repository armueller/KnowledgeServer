import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables for tests
vi.mock('~/env', () => ({
  getRegion: () => 'us-west-2',
  getNodeEnv: () => 'test',
  getOrigin: () => 'http://localhost:5173',
  getApiBaseUrl: () => 'http://localhost:5173/api',
  getNeo4jUri: () => 'neo4j://localhost:7687',
  getNeo4jUsername: () => 'test-user',
  getNeo4jPassword: () => 'test-password',
}));

// Mock Neo4j driver
vi.mock('neo4j-driver', () => ({
  driver: vi.fn(() => ({
    close: vi.fn(),
    executeQuery: vi.fn(),
  })),
  auth: {
    basic: vi.fn(),
  },
}));

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn(() => ({})),
  GetParameterCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-secretsmanager', () => ({
  SecretsManagerClient: vi.fn(() => ({})),
  GetSecretValueCommand: vi.fn(),
}));

// Mock UUID generation for consistent testing
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

// Mock Date for consistent testing
const mockDate = new Date('2024-06-15T12:00:00.000Z');
vi.setSystemTime(mockDate);