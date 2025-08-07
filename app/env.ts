/**
 * Get environment variable with default value
 */
export const getEnvVarOrDefault = (varName: string, defaultValue: string): string => {
  return process.env[varName] || defaultValue;
};

/**
 * Get environment variable or throw error if not set
 */
export const getEnvVarOrThrow = (varName: string): string => {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Environment variable ${varName} is required but not set`);
  }
  return value;
};

export const getNodeEnv = (): string => getEnvVarOrDefault('NODE_ENV', '');
export const getOrigin = (): string =>
  getNodeEnv() === 'local' ? 'http://localhost:5173' : `${getEnvVarOrDefault('APP_SUBDOMAIN', '')}.tabus10.com`;
export const getApiBaseUrl = (): string =>
  getNodeEnv() === 'local' ? 'http://localhost:5173/api' : `${getEnvVarOrDefault('APP_SUBDOMAIN', '')}.tabus10.com/api`;
export const getRegion = (): string => getEnvVarOrDefault('AWS_REGION', 'us-west-2');

// Neptune connection helpers
export const getNeptuneEndpoint = (): string => getEnvVarOrThrow('NEPTUNE_ENDPOINT');
export const getNeptuneReadEndpoint = (): string => getEnvVarOrThrow('NEPTUNE_READ_ENDPOINT');
export const getNeptunePort = (): string => getEnvVarOrDefault('NEPTUNE_PORT', '8182');

// Cognito helpers
export const getUserPoolId = (): string => getEnvVarOrThrow('USER_POOL_ID');
export const getUserPoolClientId = (): string => getEnvVarOrThrow('USER_POOL_CLIENT_ID');