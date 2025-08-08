/**
 * Repository pattern for Neptune graph database operations
 * Provides secure, type-safe access to knowledge graph with automatic multi-tenant filtering
 */

import gremlin from 'gremlin';
import type { structure } from 'gremlin';

const { driver, process: gremlinProcess, structure: structureRuntime } = gremlin;
import { getGraphTraversalSource, getReadGraphTraversalSource } from './connection';
import type {
  KnowledgeVertex,
  KnowledgeEdge,
  SecurityContext,
  SecureGraphQuery,
  QueryResult,
  BaseVertex,
  VisibilityLevel,
} from '~/models/neptune/types';
import type { SCHEMA_VERSION as SCHEMA_VERSION_TYPE } from '~/models/neptune/types';

const SCHEMA_VERSION = '1.0.0';

const { t, P, TextP, order, scope, cardinality, statics } = gremlinProcess;
const { Graph } = structureRuntime;

// Interface for Gremlin path objects
interface GremlinPath {
  objects: any[]; // Array of vertices and edges in the path
}

/**
 * Base repository with security filtering
 */
export abstract class BaseNeptuneRepository {
  protected securityContext: SecurityContext;
  
  constructor(securityContext: SecurityContext) {
    this.securityContext = securityContext;
  }
  
  /**
   * Apply security filters to any graph traversal
   * This ensures multi-tenant isolation and access control
   */
  protected applySecurityFilter(traversal: any): any {
    const { tenantId, userId, teamIds } = this.securityContext;
    
    // Always enforce tenant isolation first
    traversal = traversal.has('tenantId', tenantId);
    
    // Then apply visibility rules
    return traversal.or(
      // Private access - user owns the vertex
      statics.has('userId', userId).has('visibility', 'private'),
      
      // Team access - user is part of the team
      teamIds.length > 0 
        ? statics.has('teamId', P.within(...teamIds)).has('visibility', 'team')
        : statics.has('visibility', 'never'), // Impossible condition if no teams
      
      // Organization access - same tenant
      statics.has('visibility', 'organization'),
      
      // Shared access - explicitly shared with user
      statics.has('sharedWith', userId)
    );
  }
  
  /**
   * Add base properties to a new vertex
   */
  protected addBaseProperties(properties: Partial<BaseVertex>): Record<string, any> {
    const now = Date.now();
    const { tenantId, userId, teamIds } = this.securityContext;
    
    return {
      ...properties,
      tenantId,
      userId,
      teamId: properties.teamId || (teamIds.length > 0 ? teamIds[0] : undefined),
      visibility: properties.visibility || 'private',
      accessLevel: properties.accessLevel || 'write',
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      schemaVersion: SCHEMA_VERSION,
      tags: properties.tags || [],
      keywords: properties.keywords || [],
      sharedWith: properties.sharedWith || [],
    };
  }
}

/**
 * Repository for vertex operations
 */
export class VertexRepository extends BaseNeptuneRepository {
  
  /**
   * Create a new vertex with security context
   */
  async createVertex<T extends KnowledgeVertex>(
    vertex: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'tenantId'>
  ): Promise<T> {
    const g = getGraphTraversalSource();
    
    // Generate unique ID
    const id = `${vertex.type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add base properties with security context
    const properties = this.addBaseProperties({
      ...vertex,
      id,
    });
    
    // Create vertex with all properties
    let traversal = g.addV(vertex.type);
    
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Handle array properties
          for (const item of value) {
            traversal = traversal.property(cardinality.set, key, item);
          }
        } else if (typeof value === 'object') {
          // Store objects as JSON strings
          traversal = traversal.property(key, JSON.stringify(value));
        } else {
          traversal = traversal.property(key, value);
        }
      }
    }
    
    // Use elementMap() directly in the traversal chain for efficiency
    const result = await traversal.elementMap().next();
    return this.mapVertexToType<T>(result.value);
  }
  
  /**
   * Find vertex by ID with security check
   */
  async findById<T extends KnowledgeVertex>(id: string): Promise<T | null> {
    const g = getReadGraphTraversalSource();
    
    let traversal = g.V().has('id', id);
    traversal = this.applySecurityFilter(traversal);
    
    // Use elementMap() directly in the traversal chain
    const result = await traversal.elementMap().next();
    return result.value ? this.mapVertexToType<T>(result.value) : null;
  }
  
  /**
   * Query vertices with filters and security
   */
  async query<T extends KnowledgeVertex>(query: SecureGraphQuery): Promise<QueryResult<T>> {
    const g = getReadGraphTraversalSource();
    
    // Start with vertex label if type is specified
    let traversal = query.vertexFilters?.type 
      ? g.V().hasLabel(query.vertexFilters.type)
      : g.V();
    
    // Apply security filters first
    traversal = this.applySecurityFilter(traversal);
    
    // Apply additional filters
    if (query.vertexFilters) {
      for (const [key, value] of Object.entries(query.vertexFilters)) {
        if (key !== 'type' && value !== undefined) {
          if (Array.isArray(value)) {
            traversal = traversal.has(key, P.within(...value));
          } else {
            traversal = traversal.has(key, value);
          }
        }
      }
    }
    
    // Count total before pagination - rebuild traversal instead of clone to avoid Neptune casting issues
    let countTraversal = query.vertexFilters?.type 
      ? g.V().hasLabel(query.vertexFilters.type)
      : g.V();
    
    // Reapply security filters
    countTraversal = this.applySecurityFilter(countTraversal);
    
    // Reapply additional filters
    if (query.vertexFilters) {
      for (const [key, value] of Object.entries(query.vertexFilters)) {
        if (key !== 'type' && value !== undefined) {
          if (Array.isArray(value)) {
            countTraversal = countTraversal.has(key, P.within(...value));
          } else {
            countTraversal = countTraversal.has(key, value);
          }
        }
      }
    }
    
    const totalCount = await countTraversal.count().next();
    
    // Apply ordering
    if (query.orderBy) {
      traversal = traversal.order().by(
        query.orderBy,
        query.orderDirection === 'DESC' ? order.desc : order.asc
      );
    }
    
    // Apply pagination
    if (query.offset) {
      traversal = traversal.skip(query.offset);
    }
    if (query.limit) {
      traversal = traversal.limit(query.limit);
    }
    
    // Execute query with elementMap() for efficient property retrieval
    const results = await traversal.elementMap().toList();
    const data = results.map((elementData: any) => this.mapVertexToType<T>(elementData));
    
    return {
      data,
      count: data.length,
      hasMore: (query.offset || 0) + data.length < totalCount.value,
      securityContext: this.securityContext,
    };
  }
  
  /**
   * Update vertex with security check
   */
  async updateVertex<T extends KnowledgeVertex>(
    id: string,
    updates: Partial<T>
  ): Promise<T | null> {
    const g = getGraphTraversalSource();
    
    // Check if user has write access
    let checkTraversal = g.V().has('id', id);
    checkTraversal = this.applySecurityFilter(checkTraversal);
    checkTraversal = checkTraversal.has('accessLevel', P.within('write', 'admin'));
    
    const canUpdate = await checkTraversal.hasNext();
    if (!canUpdate) {
      throw new Error('Insufficient permissions to update this vertex');
    }
    
    // Perform update
    let traversal = g.V().has('id', id);
    
    // Update properties
    const now = Date.now();
    traversal = traversal
      .property('updatedAt', now)
      .property('updatedBy', this.securityContext.userId);
    
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'type' && key !== 'tenantId' && value !== undefined) {
        if (Array.isArray(value)) {
          // Replace array properties
          traversal = traversal.sideEffect(
            statics.properties(key).drop()
          );
          for (const item of value) {
            traversal = traversal.property(cardinality.set, key, item);
          }
        } else if (typeof value === 'object') {
          traversal = traversal.property(key, JSON.stringify(value));
        } else {
          traversal = traversal.property(key, value);
        }
      }
    }
    
    // Use elementMap() directly in the traversal chain
    const result = await traversal.elementMap().next();
    return result.value ? this.mapVertexToType<T>(result.value) : null;
  }
  
  /**
   * Delete vertex with security check
   */
  async deleteVertex(id: string): Promise<boolean> {
    const g = getGraphTraversalSource();
    
    // Check if user has admin access
    let checkTraversal = g.V().has('id', id);
    checkTraversal = this.applySecurityFilter(checkTraversal);
    checkTraversal = checkTraversal.has('accessLevel', 'admin');
    
    const canDelete = await checkTraversal.hasNext();
    if (!canDelete) {
      throw new Error('Insufficient permissions to delete this vertex');
    }
    
    // Delete vertex and all its edges
    await g.V().has('id', id).drop().next();
    return true;
  }
  
  /**
   * Share vertex with users or teams
   */
  async shareVertex(id: string, shareWith: string[], visibility: VisibilityLevel = 'shared'): Promise<boolean> {
    const g = getGraphTraversalSource();
    
    // Check if user has admin access to share
    let checkTraversal = g.V().has('id', id);
    checkTraversal = this.applySecurityFilter(checkTraversal);
    checkTraversal = checkTraversal.has('accessLevel', P.within('write', 'admin'));
    
    const canShare = await checkTraversal.hasNext();
    if (!canShare) {
      throw new Error('Insufficient permissions to share this vertex');
    }
    
    // Update sharing
    let traversal = g.V().has('id', id)
      .property('visibility', visibility);
    
    for (const userId of shareWith) {
      traversal = traversal.property(gremlinProcess.cardinality.set, 'sharedWith', userId);
    }
    
    await traversal.next();
    return true;
  }
  
  /**
   * Map Gremlin vertex to TypeScript type
   * Now works with elementMap() data format after GraphSON v2 fix
   */
  private mapVertexToType<T extends KnowledgeVertex>(elementData: any): T {
    if (!elementData) {
      throw new Error('No element data to map');
    }
    
    // With elementMap() and GraphSON v2, properties are directly accessible
    const properties: any = { ...elementData };
    
    // Parse JSON strings back to objects for metadata fields
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === 'string' && (key === 'metadata' || key.endsWith('Config'))) {
        try {
          properties[key] = JSON.parse(value);
        } catch {
          // Keep as string if not valid JSON
          properties[key] = value;
        }
      }
    }
    
    // Ensure type is set from label if needed
    if (properties.label && !properties.type) {
      properties.type = properties.label;
    }
    
    return properties as T;
  }
}

/**
 * Repository for edge operations
 */
export class EdgeRepository extends BaseNeptuneRepository {
  
  /**
   * Create edge between vertices with security check
   */
  async createEdge<T extends KnowledgeEdge>(
    fromVertexId: string,
    toVertexId: string,
    edge: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'tenantId'>
  ): Promise<T> {
    const g = getGraphTraversalSource();
    
    // Check that user has access to both vertices
    let fromCheck = g.V().has('id', fromVertexId);
    fromCheck = this.applySecurityFilter(fromCheck);
    
    let toCheck = g.V().has('id', toVertexId);
    toCheck = this.applySecurityFilter(toCheck);
    
    const [canAccessFrom, canAccessTo] = await Promise.all([
      fromCheck.hasNext(),
      toCheck.hasNext()
    ]);
    
    if (!canAccessFrom || !canAccessTo) {
      throw new Error('Insufficient permissions to create edge between these vertices');
    }
    
    // Create edge with properties
    const id = `${edge.type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    let traversal = g.V().has('id', fromVertexId)
      .addE(edge.type)
      .to(statics.V().has('id', toVertexId))
      .property('id', id)
      .property('tenantId', this.securityContext.tenantId)
      .property('userId', this.securityContext.userId)
      .property('createdAt', now)
      .property('updatedAt', now)
      .property('createdBy', this.securityContext.userId)
      .property('updatedBy', this.securityContext.userId);
    
    // Add additional properties
    for (const [key, value] of Object.entries(edge)) {
      if (key !== 'type' && value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // For edges, store arrays as JSON strings since Neptune edges don't support set cardinality well
          traversal = traversal.property(key, JSON.stringify(value));
        } else if (typeof value === 'object') {
          traversal = traversal.property(key, JSON.stringify(value));
        } else {
          traversal = traversal.property(key, value);
        }
      }
    }
    
    // For edges, use valueMap(true) to get properties with id/label
    const result = await traversal.valueMap(true).next();
    return this.mapEdgeToType<T>(result.value);
  }
  
  /**
   * Find edges from a vertex
   */
  async findEdgesFrom(vertexId: string, edgeType?: string): Promise<KnowledgeEdge[]> {
    const g = getReadGraphTraversalSource();
    
    // Check vertex access
    let vertexCheck = g.V().has('id', vertexId);
    vertexCheck = this.applySecurityFilter(vertexCheck);
    
    const canAccess = await vertexCheck.hasNext();
    if (!canAccess) {
      return [];
    }
    
    // Get edges with properties using valueMap(true)
    let traversal = g.V().has('id', vertexId);
    
    if (edgeType) {
      traversal = traversal.outE(edgeType);
    } else {
      traversal = traversal.outE();
    }
    
    // Use valueMap(true) for edges to get properties with id/label
    const results = await traversal.valueMap(true).toList();
    return results.map((edgeData: any) => this.mapEdgeToType(edgeData));
  }
  
  /**
   * Map Gremlin edge to TypeScript type
   * Now works with valueMap(true) data format for edges
   */
  private mapEdgeToType<T extends KnowledgeEdge>(edgeData: any): T {
    if (!edgeData) {
      throw new Error('No edge data to map');
    }
    
    const properties: any = {};
    
    // With valueMap(true) and GraphSON v2, we get a map with special keys
    // Extract id and label from special keys
    if (edgeData.id) {
      properties.id = Array.isArray(edgeData.id) ? edgeData.id[0] : edgeData.id;
    }
    if (edgeData.label) {
      properties.type = Array.isArray(edgeData.label) ? edgeData.label[0] : edgeData.label;
    }
    
    // Extract other properties - they may be in arrays due to set cardinality
    for (const [key, value] of Object.entries(edgeData)) {
      if (key !== 'id' && key !== 'label') {
        // Handle array values from valueMap
        const actualValue = Array.isArray(value) ? value[0] : value;
        
        if (typeof actualValue === 'string' && (key === 'metadata' || key === 'responsibilities' || key === 'tags' || key === 'keywords')) {
          try {
            properties[key] = JSON.parse(actualValue);
          } catch {
            properties[key] = actualValue;
          }
        } else {
          properties[key] = actualValue;
        }
      }
    }
    
    return properties as T;
  }
}

/**
 * Main repository facade
 */
export class KnowledgeGraphRepository {
  public vertices: VertexRepository;
  public edges: EdgeRepository;
  
  constructor(securityContext: SecurityContext) {
    this.vertices = new VertexRepository(securityContext);
    this.edges = new EdgeRepository(securityContext);
  }
  
  /**
   * Perform a complex graph traversal with security
   */
  async traverseGraph(
    startVertexId: string,
    depth: number = 3,
    edgeTypes?: string[]
  ): Promise<any> {
    const g = getReadGraphTraversalSource();
    
    // Apply security filter to start vertex
    let traversal = g.V().has('id', startVertexId);
    traversal = this.vertices['applySecurityFilter'](traversal);
    
    // Build path traversal
    let pathTraversal = traversal;
    
    for (let i = 0; i < depth; i++) {
      if (edgeTypes && edgeTypes.length > 0) {
        pathTraversal = pathTraversal.both(...edgeTypes);
      } else {
        pathTraversal = pathTraversal.both();
      }
      
      // Apply security filter at each level
      pathTraversal = this.vertices['applySecurityFilter'](pathTraversal);
    }
    
    // Get paths
    const paths = await pathTraversal.path().limit(100).toList();
    
    return (paths as GremlinPath[]).map(path => ({
      vertices: path.objects.filter((_: any, i: number) => i % 2 === 0),
      edges: path.objects.filter((_: any, i: number) => i % 2 === 1),
    }));
  }
}