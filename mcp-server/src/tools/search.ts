import { 
  SearchByNameSchema,
  SearchByDomainSchema,
  SearchByTagSchema,
  SearchByProjectSchema,
  SearchByFilePathSchema,
  GraphTraversalSchema,
  ListVerticesSchema,
  type SearchByName,
  type SearchByDomain,
  type SearchByTag,
  type SearchByProject,
  type SearchByFilePath,
  type GraphTraversal,
  type ListVertices,
} from '../types/tools.js';
import { apiClient } from '../utils/api-client.js';
import { cacheManager } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Search vertices by name with support for exact, partial, and regex matching
 */
export async function searchByName(params: SearchByName) {
  const cacheKey = cacheManager.generateKey('searchByName', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    // Use list vertices with server-side name filtering
    const result = await apiClient.listVertices({
      type: params.type,
      project: params.project,
      name: params.name,
      nameMatch: params.matchType,
      limit: params.limit,
      offset: params.offset,
    });

    const formatted = {
      searchTerm: params.name,
      matchType: params.matchType,
      type: params.type,
      project: params.project,
      results: result.data || [],
      count: result.count || result.data?.length || 0,
      hasMore: result.hasMore || false,
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('searchByName failed:', error);
    throw new Error(`Failed to search by name: ${error}`);
  }
}

/**
 * Search vertices by file path with support for exact, partial, and regex matching
 */
export async function searchByFilePath(params: SearchByFilePath) {
  const cacheKey = cacheManager.generateKey('searchByFilePath', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    // Use list vertices with server-side file path filtering
    const result = await apiClient.listVertices({
      type: params.type,
      project: params.project,
      filePath: params.filePath,
      filePathMatch: params.matchType,
      limit: params.limit,
      offset: params.offset,
    });

    const formatted = {
      searchTerm: params.filePath,
      matchType: params.matchType,
      type: params.type,
      project: params.project,
      results: result.data || [],
      count: result.count || result.data?.length || 0,
      hasMore: result.hasMore || false,
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('searchByFilePath failed:', error);
    throw new Error(`Failed to search by file path: ${error}`);
  }
}

/**
 * Search vertices by domain with support for exact, partial, and regex matching
 */
export async function searchByDomain(params: SearchByDomain) {
  const cacheKey = cacheManager.generateKey('searchByDomain', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await apiClient.searchKnowledge({
      searchType: 'domain',
      domain: params.domain,
      domainMatch: params.matchType,
      project: params.project,
      limit: params.limit,
      offset: params.offset,
    });

    // Format response for Claude
    const formatted = {
      domain: params.domain,
      matchType: params.matchType,
      project: params.project,
      results: result.results || [],
      count: result.count || 0,
      hasMore: result.hasMore || false,
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('searchByDomain failed:', error);
    throw new Error(`Failed to search by domain: ${error}`);
  }
}

/**
 * Search vertices by tag with support for exact, partial, and regex matching
 */
export async function searchByTag(params: SearchByTag) {
  const cacheKey = cacheManager.generateKey('searchByTag', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await apiClient.searchKnowledge({
      searchType: 'tag',
      tag: params.tag,
      tagMatch: params.matchType,
      project: params.project,
      limit: params.limit,
      offset: params.offset,
    });

    const formatted = {
      tag: params.tag,
      matchType: params.matchType,
      project: params.project,
      results: result.results || [],
      count: result.count || 0,
      hasMore: result.hasMore || false,
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('searchByTag failed:', error);
    throw new Error(`Failed to search by tag: ${error}`);
  }
}

/**
 * Search vertices by project
 */
export async function searchByProject(params: SearchByProject) {
  const cacheKey = cacheManager.generateKey('searchByProject', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await apiClient.searchKnowledge({
      searchType: 'project',
      project: params.project,
      limit: params.limit,
      offset: params.offset,
    });

    const formatted = {
      project: params.project,
      results: result.results || [],
      count: result.count || 0,
      hasMore: result.hasMore || false,
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('searchByProject failed:', error);
    throw new Error(`Failed to search by project: ${error}`);
  }
}

/**
 * Perform graph traversal from a starting vertex
 */
export async function graphTraversal(params: GraphTraversal) {
  const cacheKey = cacheManager.generateKey('graphTraversal', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await apiClient.searchKnowledge({
      searchType: 'traversal',
      startId: params.startId,
      depth: params.depth,
      limit: params.limit,
    });

    const formatted = {
      startId: params.startId,
      depth: params.depth,
      paths: result.results || [],
      pathCount: result.pathCount || 0,
      totalPaths: result.totalPaths || 0,
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('graphTraversal failed:', error);
    throw new Error(`Failed to traverse graph: ${error}`);
  }
}

/**
 * List vertices with optional filters
 */
export async function listVertices(params: ListVertices) {
  const cacheKey = cacheManager.generateKey('listVertices', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await apiClient.listVertices({
      type: params.type,
      domain: params.domain,
      project: params.project,
      limit: params.limit,
      offset: params.offset,
    });

    const formatted = {
      filters: {
        type: params.type,
        domain: params.domain,
        project: params.project,
      },
      vertices: result.data || [],
      count: result.count || 0,
      hasMore: result.hasMore || false,
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('listVertices failed:', error);
    throw new Error(`Failed to list vertices: ${error}`);
  }
}

// Export tool definitions for MCP server registration
export const searchTools = {
  search_by_name: {
    description: 'Search knowledge vertices by name with exact, partial, or regex matching, optionally filtered by type and project',
    inputSchema: SearchByNameSchema,
    handler: searchByName,
  },
  search_by_file_path: {
    description: 'Search for all vertices (functions, models, etc.) that belong to a specific file path with exact, partial, or regex matching',
    inputSchema: SearchByFilePathSchema,
    handler: searchByFilePath,
  },
  search_by_domain: {
    description: 'Search knowledge vertices by domain with exact, partial, or regex matching, optionally filtered by project',
    inputSchema: SearchByDomainSchema,
    handler: searchByDomain,
  },
  search_by_tag: {
    description: 'Search knowledge vertices by tag with exact, partial, or regex matching, optionally filtered by project',
    inputSchema: SearchByTagSchema,
    handler: searchByTag,
  },
  search_by_project: {
    description: 'Search knowledge vertices by project',
    inputSchema: SearchByProjectSchema,
    handler: searchByProject,
  },
  graph_traversal: {
    description: 'Traverse the knowledge graph from a starting vertex',
    inputSchema: GraphTraversalSchema,
    handler: graphTraversal,
  },
  list_vertices: {
    description: 'List vertices with optional type, domain, and project filters',
    inputSchema: ListVerticesSchema,
    handler: listVertices,
  },
};