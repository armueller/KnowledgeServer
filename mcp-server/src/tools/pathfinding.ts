import { 
  FindConnectionSchema,
  TraceExecutionPathSchema,
  FindCommonDependenciesSchema,
  FindReachableVerticesSchema,
  type FindConnection,
  type TraceExecutionPath,
  type FindCommonDependencies,
  type FindReachableVertices,
} from '../types/tools.js';
import { apiClient } from '../utils/api-client.js';
import { cacheManager } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Find connection path between two vertices
 */
export async function findConnection(params: FindConnection) {
  const cacheKey = cacheManager.generateKey('findConnection', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    // Use the relationships API to find paths
    const queryParams: any = {
      op: 'path',
      from: params.fromId,
      to: params.toId,
      maxDepth: params.maxDepth,
    };
    
    if (params.edgeTypes && params.edgeTypes.length > 0) {
      queryParams.edgeTypes = params.edgeTypes.join(',');
    }

    const result = await apiClient.request('/api/relationships', {
      params: queryParams,
    });

    // Format the response
    const formatted = {
      from: params.fromId,
      to: params.toId,
      pathFound: result.pathFound || false,
      shortestPath: result.shortestPath || null,
      allPaths: params.shortestOnly ? [result.shortestPath].filter(Boolean) : result.paths || [],
      pathLength: result.shortestPath?.length || 0,
      summary: result.pathFound 
        ? `Found ${result.paths?.length || 1} path(s) between vertices`
        : 'No path found between vertices',
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('findConnection failed:', error);
    throw new Error(`Failed to find connection: ${error}`);
  }
}

/**
 * Trace execution path through function calls
 */
export async function traceExecutionPath(params: TraceExecutionPath) {
  const cacheKey = cacheManager.generateKey('traceExecutionPath', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    // First, find the entry point vertex
    const entryVertex = await apiClient.request('/api/vertices', {
      params: {
        op: 'search',
        name: params.entryPoint,
        type: 'Function',
      },
    });

    if (!entryVertex || !entryVertex.data || entryVertex.data.length === 0) {
      throw new Error(`Entry point function not found: ${params.entryPoint}`);
    }

    const entryId = entryVertex.data[0].vertexId;

    // Trace the execution path using traversal
    const queryParams: any = {
      op: 'traverse',
      from: entryId,
      depth: params.maxDepth,
      edgeTypes: params.includeAsync ? 'CALLS,INVOKES,TRIGGERS' : 'CALLS',
    };

    const result = await apiClient.request('/api/relationships', {
      params: queryParams,
    });

    // Build execution tree
    const executionTree = buildExecutionTree(result.paths || [], entryId);

    const formatted = {
      entryPoint: params.entryPoint,
      entryPointId: entryId,
      endpoint: params.endpoint,
      executionPaths: result.paths || [],
      functionsCalled: extractUniqueFunctions(result.paths || []),
      maxDepthReached: result.maxDepth || 0,
      executionTree,
      asyncCalls: params.includeAsync ? extractAsyncCalls(result.paths || []) : [],
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('traceExecutionPath failed:', error);
    throw new Error(`Failed to trace execution path: ${error}`);
  }
}

/**
 * Find common dependencies between multiple vertices
 */
export async function findCommonDependencies(params: FindCommonDependencies) {
  const cacheKey = cacheManager.generateKey('findCommonDependencies', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    // Get dependencies for each vertex
    const dependencyPromises = params.vertexIds.map(id => 
      apiClient.request('/api/analysis', {
        params: {
          type: 'dependency',
          vertexId: id,
          direction: params.direction === 'both' ? 'both' : 
                   params.direction === 'dependents' ? 'reverse' : 'forward',
          maxDepth: params.maxDepth,
        },
      })
    );

    const allDependencies = await Promise.all(dependencyPromises);

    // Find common dependencies
    const commonDeps = findIntersection(
      allDependencies.map(result => result.dependencies || [])
    );

    const formatted = {
      vertices: params.vertexIds,
      direction: params.direction,
      commonDependencies: commonDeps,
      commonCount: commonDeps.length,
      individualCounts: params.vertexIds.map((id, i) => ({
        vertexId: id,
        dependencyCount: allDependencies[i].dependencies?.length || 0,
      })),
      analysis: {
        tightlyCoupled: commonDeps.length > 5,
        recommendation: commonDeps.length > 5 
          ? 'Consider refactoring to reduce coupling'
          : 'Coupling level is acceptable',
      },
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('findCommonDependencies failed:', error);
    throw new Error(`Failed to find common dependencies: ${error}`);
  }
}

/**
 * Find all vertices reachable from a starting point
 */
export async function findReachableVertices(params: FindReachableVertices) {
  const cacheKey = cacheManager.generateKey('findReachableVertices', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const queryParams: any = {
      op: 'traverse',
      from: params.fromId,
      depth: params.maxDepth,
    };
    
    if (params.edgeTypes && params.edgeTypes.length > 0) {
      queryParams.edgeTypes = params.edgeTypes.join(',');
    }

    const result = await apiClient.request('/api/relationships', {
      params: queryParams,
    });

    // Extract unique vertices from paths
    const reachableVertices = extractUniqueVertices(result.paths || []);
    
    // Group by distance
    const byDistance = groupByDistance(result.paths || []);

    const formatted = {
      startVertex: params.fromId,
      reachableCount: reachableVertices.length,
      reachableVertices,
      byDistance,
      maxDepth: params.maxDepth,
      directConnections: byDistance[1] || [],
      leafNodes: findLeafNodes(result.paths || []),
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('findReachableVertices failed:', error);
    throw new Error(`Failed to find reachable vertices: ${error}`);
  }
}

// Helper functions

function buildExecutionTree(paths: any[], rootId: string): any {
  const tree: any = { id: rootId, children: [] };
  const visited = new Set<string>();

  function addToTree(node: any, path: any[], depth: number = 0) {
    if (depth >= path.length || visited.has(path[depth].id)) return;
    
    visited.add(path[depth].id);
    const child = {
      id: path[depth].id,
      name: path[depth].name,
      type: path[depth].edgeType,
      children: [],
    };
    
    node.children.push(child);
    addToTree(child, path, depth + 1);
  }

  paths.forEach(path => addToTree(tree, path, 0));
  return tree;
}

function extractUniqueFunctions(paths: any[]): string[] {
  const functions = new Set<string>();
  paths.forEach(path => {
    path.forEach((node: any) => {
      if (node.type === 'Function') {
        functions.add(node.name || node.id);
      }
    });
  });
  return Array.from(functions);
}

function extractAsyncCalls(paths: any[]): any[] {
  const asyncCalls: any[] = [];
  paths.forEach(path => {
    path.forEach((node: any, index: number) => {
      if (node.edgeType === 'INVOKES' || node.edgeType === 'TRIGGERS') {
        asyncCalls.push({
          from: path[index - 1]?.name || path[index - 1]?.id,
          to: node.name || node.id,
          type: node.edgeType,
        });
      }
    });
  });
  return asyncCalls;
}

function findIntersection(arrays: any[][]): any[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0];
  
  const idSets = arrays.map(arr => 
    new Set(arr.map(item => item.id || item.vertexId))
  );
  
  const commonIds = Array.from(idSets[0]).filter(id =>
    idSets.every(set => set.has(id))
  );
  
  // Return the full objects for common IDs
  return arrays[0].filter(item => 
    commonIds.includes(item.id || item.vertexId)
  );
}

function extractUniqueVertices(paths: any[]): any[] {
  const vertexMap = new Map();
  paths.forEach(path => {
    path.forEach((node: any) => {
      const id = node.id || node.vertexId;
      if (!vertexMap.has(id)) {
        vertexMap.set(id, {
          id,
          name: node.name,
          type: node.type,
        });
      }
    });
  });
  return Array.from(vertexMap.values());
}

function groupByDistance(paths: any[]): Record<number, any[]> {
  const distanceMap: Record<number, Set<string>> = {};
  
  paths.forEach(path => {
    path.forEach((node: any, index: number) => {
      const distance = index + 1;
      if (!distanceMap[distance]) {
        distanceMap[distance] = new Set();
      }
      distanceMap[distance].add(node.id || node.vertexId);
    });
  });
  
  const result: Record<number, any[]> = {};
  Object.entries(distanceMap).forEach(([distance, ids]) => {
    result[parseInt(distance)] = Array.from(ids);
  });
  
  return result;
}

function findLeafNodes(paths: any[]): string[] {
  const hasOutgoing = new Set<string>();
  const allNodes = new Set<string>();
  
  paths.forEach(path => {
    path.forEach((node: any, index: number) => {
      const id = node.id || node.vertexId;
      allNodes.add(id);
      if (index < path.length - 1) {
        hasOutgoing.add(id);
      }
    });
  });
  
  return Array.from(allNodes).filter(id => !hasOutgoing.has(id));
}

// Export tool definitions for MCP server registration
export const pathfindingTools = {
  find_connection: {
    description: 'Find connection path between two vertices in the knowledge graph',
    inputSchema: FindConnectionSchema,
    handler: findConnection,
  },
  trace_execution_path: {
    description: 'Trace code execution flow from an entry point through function calls',
    inputSchema: TraceExecutionPathSchema,
    handler: traceExecutionPath,
  },
  find_common_dependencies: {
    description: 'Find dependencies or dependents that multiple vertices have in common',
    inputSchema: FindCommonDependenciesSchema,
    handler: findCommonDependencies,
  },
  find_reachable_vertices: {
    description: 'Find all vertices reachable from a starting point within a given depth',
    inputSchema: FindReachableVerticesSchema,
    handler: findReachableVertices,
  },
};