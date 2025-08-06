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

// Neo4j connection helpers
export const getNeo4jUri = (): string => getEnvVarOrThrow('NEO4J_URI');
export const getNeo4jUsername = (): string => getEnvVarOrThrow('NEO4J_USERNAME');
export const getNeo4jPassword = (): string => getEnvVarOrThrow('NEO4J_PASSWORD');