import gremlin from 'gremlin';
import type { driver, structure } from 'gremlin';
import { getNeptuneEndpoint, getNeptuneReadEndpoint, getNeptunePort, getRegion } from '~/env';

const { driver: driverRuntime, process, structure: structureRuntime } = gremlin;
const { DriverRemoteConnection } = driverRuntime;

let connection: driver.DriverRemoteConnection | null = null;
let readConnection: driver.DriverRemoteConnection | null = null;
let graph: structure.Graph | null = null;

/**
 * Get Neptune Gremlin connection with SSL/TLS (required for AWS Neptune)
 * Uses write endpoint for mutations
 */
export function getNeptuneConnection(): driver.DriverRemoteConnection {
  if (!connection) {
    const endpoint = getNeptuneEndpoint();
    const port = getNeptunePort();
    
    // Neptune requires wss:// (WebSocket Secure) connection
    const neptuneWsUrl = `wss://${endpoint}:${port}/gremlin`;
    
    // Use GraphSON v2 to fix valueMap()/elementMap() compatibility issue with JavaScript driver
    // This is AWS-recommended solution for Neptune + JavaScript driver compatibility
    // Issue: GraphBinary (default) and GraphSON v3 return empty objects for property mapping
    connection = new DriverRemoteConnection(neptuneWsUrl, {
      mimeType: 'application/vnd.gremlin-v2.0+json'
    });
  }
  
  return connection;
}

/**
 * Get Neptune read-only connection for queries
 * Uses read endpoint for better performance on read operations
 */
export function getNeptuneReadConnection(): driver.DriverRemoteConnection {
  if (!readConnection) {
    const readEndpoint = getNeptuneReadEndpoint();
    const port = getNeptunePort();
    
    // Neptune requires wss:// (WebSocket Secure) connection
    const neptuneReadWsUrl = `wss://${readEndpoint}:${port}/gremlin`;
    
    // Use GraphSON v2 for read connection consistency
    readConnection = new DriverRemoteConnection(neptuneReadWsUrl, {
      mimeType: 'application/vnd.gremlin-v2.0+json'
    });
  }
  
  return readConnection;
}

/**
 * Get Graph traversal source for write operations
 */
export function getGraphTraversalSource() {
  if (!graph) {
    graph = new structureRuntime.Graph();
  }
  
  return graph.traversal().withRemote(getNeptuneConnection());
}

/**
 * Get Graph traversal source for read operations
 */
export function getReadGraphTraversalSource() {
  if (!graph) {
    graph = new structureRuntime.Graph();
  }
  
  return graph.traversal().withRemote(getNeptuneReadConnection());
}

/**
 * Close all Neptune connections
 */
export async function closeNeptuneConnections(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  
  if (connection) {
    closePromises.push(connection.close());
    connection = null;
  }
  
  if (readConnection) {
    closePromises.push(readConnection.close());
    readConnection = null;
  }
  
  await Promise.all(closePromises);
}

/**
 * Test Neptune connectivity
 */
export async function testNeptuneConnection(): Promise<boolean> {
  try {
    const g = getReadGraphTraversalSource();
    // Simple query to test connection
    await g.V().limit(1).toList();
    return true;
  } catch (error) {
    console.error('Neptune connection test failed:', error);
    return false;
  }
}

/**
 * Health check for Neptune - returns connection status and basic stats
 */
export interface NeptuneHealthStatus {
  connected: boolean;
  writeEndpoint: string;
  readEndpoint: string;
  vertexCount?: number;
  edgeCount?: number;
  error?: string;
}

export async function getNeptuneHealthStatus(): Promise<NeptuneHealthStatus> {
  const endpoint = getNeptuneEndpoint();
  const readEndpoint = getNeptuneReadEndpoint();
  
  try {
    const g = getReadGraphTraversalSource();
    
    // Get basic graph statistics
    const [vertexCount, edgeCount] = await Promise.all([
      g.V().count().next(),
      g.E().count().next()
    ]);
    
    return {
      connected: true,
      writeEndpoint: endpoint,
      readEndpoint,
      vertexCount: vertexCount.value as number,
      edgeCount: edgeCount.value as number,
    };
  } catch (error) {
    return {
      connected: false,
      writeEndpoint: endpoint,
      readEndpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}