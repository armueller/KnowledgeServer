import { 
  CreateFunctionSchema,
  CreateModelSchema,
  CreatePatternSchema,
  CreateSystemSchema,
  CreateConceptSchema,
  UpdateVertexSchema,
  DeleteVertexSchema,
  CreateEdgeSchema,
  type CreateFunction,
  type CreateModel,
  type CreatePattern,
  type CreateSystem,
  type CreateConcept,
  type UpdateVertex,
  type DeleteVertex,
  type CreateEdge,
} from '../types/tools.js';
import { apiClient } from '../utils/api-client.js';
import { cacheManager } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new Function vertex
 */
export async function createFunction(params: CreateFunction) {
  try {
    // Invalidate relevant caches first
    cacheManager.invalidateByProject(params.project);
    cacheManager.invalidateByType('Function');
    
    const result = await apiClient.createVertex({
      type: 'Function',
      name: params.name,
      description: params.description,
      project: params.project,
      domain: params.domain,
      visibility: params.visibility,
      accessLevel: params.accessLevel,
      tags: params.tags,
      keywords: params.keywords,
      status: params.status,
      confidence: params.confidence,
      version: params.version,
      // Function-specific fields
      filePath: params.filePath,
      signature: params.signature,
      isAsync: params.isAsync,
      isPure: params.isPure,
      lineStart: params.lineStart,
      lineEnd: params.lineEnd,
      returnType: params.returnType,
      parameters: params.parameters,
      sideEffects: params.sideEffects,
    });

    logger.info(`Created Function vertex: ${params.name}`);
    
    return {
      success: true,
      vertex: result,
      message: `Successfully created Function: ${params.name}`,
    };
  } catch (error) {
    logger.error('createFunction failed:', error);
    throw new Error(`Failed to create Function: ${error}`);
  }
}

/**
 * Create a new Model vertex
 */
export async function createModel(params: CreateModel) {
  try {
    cacheManager.invalidateByProject(params.project);
    cacheManager.invalidateByType('Model');
    
    const result = await apiClient.createVertex({
      type: 'Model',
      name: params.name,
      description: params.description,
      project: params.project,
      domain: params.domain,
      visibility: params.visibility,
      accessLevel: params.accessLevel,
      tags: params.tags,
      keywords: params.keywords,
      status: params.status,
      confidence: params.confidence,
      version: params.version,
      // Model-specific fields
      filePath: params.filePath,
      lineStart: params.lineStart,
      lineEnd: params.lineEnd,
      modelType: params.modelType,
      properties: params.properties,
      methods: params.methods,
      extends: params.extends,
      implements: params.implements,
    });

    logger.info(`Created Model vertex: ${params.name}`);
    
    return {
      success: true,
      vertex: result,
      message: `Successfully created Model: ${params.name}`,
    };
  } catch (error) {
    logger.error('createModel failed:', error);
    throw new Error(`Failed to create Model: ${error}`);
  }
}

/**
 * Create a new Pattern vertex (CRITICAL for pit of success)
 */
export async function createPattern(params: CreatePattern) {
  try {
    cacheManager.invalidateByProject(params.project);
    cacheManager.invalidateByType('Pattern');
    
    const result = await apiClient.createVertex({
      type: 'Pattern',
      name: params.name,
      description: params.description,
      project: params.project,
      domain: params.domain,
      visibility: params.visibility,
      accessLevel: params.accessLevel,
      tags: params.tags,
      keywords: params.keywords,
      status: params.status,
      confidence: params.confidence,
      version: params.version,
      // Pattern-specific fields
      patternType: params.patternType,
      problem: params.problem,
      solution: params.solution,
      examples: params.examples,
      antiPatterns: params.antiPatterns,
    });

    logger.info(`Created Pattern vertex: ${params.name} (CRITICAL for conventions)`);
    
    return {
      success: true,
      vertex: result,
      message: `Successfully created Pattern: ${params.name}`,
      note: 'This pattern will help Claude follow established conventions',
    };
  } catch (error) {
    logger.error('createPattern failed:', error);
    throw new Error(`Failed to create Pattern: ${error}`);
  }
}

/**
 * Create a new System vertex
 */
export async function createSystem(params: CreateSystem) {
  try {
    cacheManager.invalidateByProject(params.project);
    cacheManager.invalidateByType('System');
    
    const result = await apiClient.createVertex({
      type: 'System',
      name: params.name,
      description: params.description,
      project: params.project,
      domain: params.domain,
      visibility: params.visibility,
      accessLevel: params.accessLevel,
      tags: params.tags,
      keywords: params.keywords,
      status: params.status,
      confidence: params.confidence,
      version: params.version,
      // System-specific fields
      systemDomain: params.systemDomain,
      boundaries: params.boundaries,
      interfaces: params.interfaces,
      contracts: params.contracts,
    });

    logger.info(`Created System vertex: ${params.name}`);
    
    return {
      success: true,
      vertex: result,
      message: `Successfully created System: ${params.name}`,
    };
  } catch (error) {
    logger.error('createSystem failed:', error);
    throw new Error(`Failed to create System: ${error}`);
  }
}

/**
 * Create a new Concept vertex
 */
export async function createConcept(params: CreateConcept) {
  try {
    cacheManager.invalidateByProject(params.project);
    cacheManager.invalidateByType('Concept');
    
    const result = await apiClient.createVertex({
      type: 'Concept',
      name: params.name,
      description: params.description,
      project: params.project,
      domain: params.domain,
      visibility: params.visibility,
      accessLevel: params.accessLevel,
      tags: params.tags,
      keywords: params.keywords,
      status: params.status,
      confidence: params.confidence,
      version: params.version,
      // Concept-specific fields
      conceptType: params.conceptType,
      definition: params.definition,
      examples: params.examples,
      relationships: params.relationships,
      synonyms: params.synonyms,
    });

    logger.info(`Created Concept vertex: ${params.name}`);
    
    return {
      success: true,
      vertex: result,
      message: `Successfully created Concept: ${params.name}`,
    };
  } catch (error) {
    logger.error('createConcept failed:', error);
    throw new Error(`Failed to create Concept: ${error}`);
  }
}

/**
 * Update an existing vertex
 */
export async function updateVertex(params: UpdateVertex) {
  try {
    // Invalidate caches for this vertex
    cacheManager.invalidateByVertex(params.id);
    
    const result = await apiClient.updateVertex(params.id, params.updates);
    
    logger.info(`Updated vertex: ${params.id}`);
    
    return {
      success: true,
      vertex: result,
      message: `Successfully updated vertex: ${params.id}`,
      updatedFields: Object.keys(params.updates),
    };
  } catch (error) {
    logger.error('updateVertex failed:', error);
    throw new Error(`Failed to update vertex: ${error}`);
  }
}

/**
 * Delete a vertex
 */
export async function deleteVertex(params: DeleteVertex) {
  try {
    // First get the vertex to understand what we're deleting
    const vertex = await apiClient.getVertex(params.id);
    
    // Invalidate all relevant caches
    cacheManager.invalidateByVertex(params.id);
    if (vertex.project) {
      cacheManager.invalidateByProject(vertex.project);
    }
    if (vertex.type) {
      cacheManager.invalidateByType(vertex.type);
    }
    
    await apiClient.deleteVertex(params.id);
    
    logger.info(`Deleted vertex: ${params.id} (${vertex.name})`);
    
    return {
      success: true,
      message: `Successfully deleted vertex: ${vertex.name} (${params.id})`,
      deletedVertex: {
        id: params.id,
        name: vertex.name,
        type: vertex.type,
      },
    };
  } catch (error) {
    logger.error('deleteVertex failed:', error);
    throw new Error(`Failed to delete vertex: ${error}`);
  }
}

/**
 * Create an edge (relationship) between vertices
 */
export async function createEdge(params: CreateEdge) {
  try {
    // Invalidate caches for both vertices
    cacheManager.invalidateByVertex(params.fromVertexId);
    cacheManager.invalidateByVertex(params.toVertexId);
    
    const edgeData: any = {
      fromVertexId: params.fromVertexId,
      toVertexId: params.toVertexId,
      type: params.type,
      visibility: params.visibility,
    };
    
    // Add BELONGS_TO specific fields if present
    if (params.type === 'BELONGS_TO') {
      if (params.role) edgeData.role = params.role;
      if (params.responsibilities) edgeData.responsibilities = params.responsibilities;
    }
    
    const result = await apiClient.createEdge(edgeData);
    
    logger.info(`Created edge: ${params.fromVertexId} -[${params.type}]-> ${params.toVertexId}`);
    
    return {
      success: true,
      edge: result,
      message: `Successfully created ${params.type} relationship`,
      summary: `${params.fromVertexId} -[${params.type}]-> ${params.toVertexId}`,
    };
  } catch (error) {
    logger.error('createEdge failed:', error);
    throw new Error(`Failed to create edge: ${error}`);
  }
}

// Export tool definitions for MCP server registration
export const managementTools = {
  create_function: {
    description: 'Create a new Function vertex in the knowledge graph',
    inputSchema: CreateFunctionSchema,
    handler: createFunction,
  },
  create_model: {
    description: 'Create a new Model vertex (interface, type, class) in the knowledge graph',
    inputSchema: CreateModelSchema,
    handler: createModel,
  },
  create_pattern: {
    description: 'Create a new Pattern vertex (CRITICAL for establishing conventions and pit of success)',
    inputSchema: CreatePatternSchema,
    handler: createPattern,
  },
  create_system: {
    description: 'Create a new System vertex representing a subsystem or service',
    inputSchema: CreateSystemSchema,
    handler: createSystem,
  },
  create_concept: {
    description: 'Create a new Concept vertex for domain concepts and business logic',
    inputSchema: CreateConceptSchema,
    handler: createConcept,
  },
  update_vertex: {
    description: 'Update properties of an existing vertex',
    inputSchema: UpdateVertexSchema,
    handler: updateVertex,
  },
  delete_vertex: {
    description: 'Delete a vertex from the knowledge graph',
    inputSchema: DeleteVertexSchema,
    handler: deleteVertex,
  },
  create_edge: {
    description: 'Create a relationship (edge) between two vertices',
    inputSchema: CreateEdgeSchema,
    handler: createEdge,
  },
};