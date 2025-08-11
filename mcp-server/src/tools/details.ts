import { 
  GetVertexSchema,
  GetEdgesSchema,
  TraverseFromVertexSchema,
  type GetVertex,
  type GetEdges,
  type TraverseFromVertex,
} from '../types/tools.js';
import { apiClient } from '../utils/api-client.js';
import { cacheManager } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Get detailed information about a specific vertex
 */
export async function getVertex(params: GetVertex) {
  const cacheKey = cacheManager.generateKey('getVertex', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await apiClient.request(`/api/vertices/${params.id}`);

    // Format response for Claude with rich context
    const formatted = {
      vertex: result,
      summary: {
        id: result.vertexId,
        type: result.type,
        name: result.name,
        domain: result.domain,
        project: result.project,
        description: result.description,
        tags: result.tags || [],
        status: result.status,
        visibility: result.visibility,
      },
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('getVertex failed:', error);
    throw new Error(`Failed to get vertex details: ${error}`);
  }
}

/**
 * Get edges (relationships) from a specific vertex
 */
export async function getEdges(params: GetEdges) {
  const cacheKey = cacheManager.generateKey('getEdges', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    // Build query parameters
    const queryParams: any = {
      op: 'from',
      from: params.from,
    };
    
    if (params.edgeTypes && params.edgeTypes.length > 0) {
      queryParams.edgeTypes = params.edgeTypes.join(',');
    }

    const result = await apiClient.request('/api/relationships', {
      params: queryParams,
    });

    // Organize edges by type for clarity
    const edgesByType: Record<string, any[]> = {};
    if (result.edges) {
      for (const edge of result.edges) {
        const type = edge.type || 'UNKNOWN';
        if (!edgesByType[type]) {
          edgesByType[type] = [];
        }
        edgesByType[type].push(edge);
      }
    }

    const formatted = {
      fromVertex: params.from,
      totalEdges: result.edges?.length || 0,
      edgesByType,
      edges: result.edges || [],
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('getEdges failed:', error);
    throw new Error(`Failed to get edges: ${error}`);
  }
}

/**
 * Traverse the graph from a starting vertex
 */
export async function traverseFromVertex(params: TraverseFromVertex) {
  const cacheKey = cacheManager.generateKey('traverseFromVertex', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    // Build query parameters for traversal
    const queryParams: any = {
      op: 'traverse',
      from: params.from,
      depth: params.depth || 2,
    };
    
    if (params.edgeTypes && params.edgeTypes.length > 0) {
      queryParams.edgeTypes = params.edgeTypes.join(',');
    }

    const result = await apiClient.request('/api/relationships', {
      params: queryParams,
    });

    // Format traversal results
    const formatted = {
      startVertex: params.from,
      depth: params.depth || 2,
      edgeTypes: params.edgeTypes || ['all'],
      paths: result.paths || [],
      verticesReached: result.verticesReached || 0,
      totalPaths: result.totalPaths || 0,
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('traverseFromVertex failed:', error);
    throw new Error(`Failed to traverse from vertex: ${error}`);
  }
}

// Export tool definitions for MCP server registration
export const detailTools = {
  get_vertex: {
    description: 'Get detailed information about a specific vertex including all its properties',
    inputSchema: GetVertexSchema,
    handler: getVertex,
  },
  get_edges: {
    description: 'Get all edges (relationships) from a specific vertex, optionally filtered by edge types',
    inputSchema: GetEdgesSchema,
    handler: getEdges,
  },
  traverse_from_vertex: {
    description: 'Traverse the graph from a starting vertex to a specified depth, following specific edge types',
    inputSchema: TraverseFromVertexSchema,
    handler: traverseFromVertex,
  },
};