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
// Anonymous traversal for use in step modulators like or()
const __ = gremlinProcess.statics;

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
    
    // Apply tenant isolation first
    traversal = traversal.has('tenantId', tenantId);
    
    // Then apply visibility rules using where() with or()
    return traversal.where(
      __.or(
        // Private access - user owns the vertex
        __.has('userId', userId).has('visibility', 'private'),
        
        // Team access - user is part of the team
        teamIds.length > 0 
          ? __.has('teamId', P.within(...teamIds)).has('visibility', 'team')
          : __.has('visibility', 'never'), // Impossible condition if no teams
        
        // Organization access - same tenant
        __.has('visibility', 'organization'),
        
        // Shared access - explicitly shared with user
        __.has('sharedWith', userId)
      )
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
    
    // Check for duplicate name within the same tenant
    if (vertex.name) {
      const existingVertex = await g.V()
        .has('tenantId', this.securityContext.tenantId)
        .has('type', vertex.type)
        .has('name', vertex.name)
        .valueMap(true)
        .next();
        
      if (existingVertex.value) {
        const existing = this.mapVertexToType<T>(existingVertex.value);
        console.log(`Duplicate vertex prevented: ${vertex.name} already exists with id ${existing.id}`);
        return existing; // Return existing vertex instead of creating duplicate
      }
    }
    
    // Don't set 'id' as a property - Neptune auto-generates vertex IDs
    // Add base properties with security context
    const properties = this.addBaseProperties({
      ...vertex,
    });
    
    // Create vertex with all properties
    let traversal = g.addV(vertex.type);
    
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Handle array properties with set cardinality
          for (const item of value) {
            traversal = traversal.property(cardinality.set, key, item);
          }
        } else if (typeof value === 'object') {
          // Store objects as JSON strings with single cardinality
          traversal = traversal.property(cardinality.single, key, JSON.stringify(value));
        } else {
          // Use single cardinality for scalar values
          traversal = traversal.property(cardinality.single, key, value);
        }
      }
    }
    
    // Use valueMap(true) to properly handle multi-value properties (arrays)
    const result = await traversal.valueMap(true).next();
    return this.mapVertexToType<T>(result.value);
  }
  
  /**
   * Find vertex by ID with security check
   */
  async findById<T extends KnowledgeVertex>(id: string): Promise<T | null> {
    const g = getReadGraphTraversalSource();
    
    // Use Neptune's internal vertex ID
    let traversal = g.V(id);
    traversal = this.applySecurityFilter(traversal);
    
    // Use valueMap(true) to preserve multi-value properties
    const result = await traversal.valueMap(true).next();
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
          if (key === 'namePattern') {
            // Handle partial name matching using TextP.containing
            traversal = traversal.has('name', TextP.containing(value));
          } else if (Array.isArray(value)) {
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
          if (key === 'namePattern') {
            // Handle partial name matching using TextP.containing
            countTraversal = countTraversal.has('name', TextP.containing(value));
          } else if (Array.isArray(value)) {
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
    
    // Execute query with valueMap(true) to preserve multi-value properties
    const results = await traversal.valueMap(true).toList();
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
    
    // Check if user has write access using Neptune's internal ID
    let checkTraversal = g.V(id);
    checkTraversal = this.applySecurityFilter(checkTraversal);
    checkTraversal = checkTraversal.has('accessLevel', P.within('write', 'admin'));
    
    const canUpdate = await checkTraversal.hasNext();
    if (!canUpdate) {
      throw new Error('Insufficient permissions to update this vertex');
    }
    
    // Perform update
    let traversal = g.V(id);
    
    // Update properties
    const now = Date.now();
    traversal = traversal
      .property(cardinality.single, 'updatedAt', now)
      .property(cardinality.single, 'updatedBy', this.securityContext.userId);
    
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
          traversal = traversal.property(cardinality.single, key, JSON.stringify(value));
        } else {
          // Use single cardinality to replace the value, not append to it
          traversal = traversal.property(cardinality.single, key, value);
        }
      }
    }
    
    // Use valueMap(true) to preserve multi-value properties
    const result = await traversal.valueMap(true).next();
    return result.value ? this.mapVertexToType<T>(result.value) : null;
  }
  
  /**
   * Delete vertex with security check
   */
  async deleteVertex(id: string): Promise<boolean> {
    const g = getGraphTraversalSource();
    
    // Check if user owns the vertex OR has admin access using Neptune's internal ID
    let checkTraversal = g.V(id);
    checkTraversal = this.applySecurityFilter(checkTraversal);
    
    // Allow deletion if user owns the vertex OR has admin access
    checkTraversal = checkTraversal.or(
      __.has('userId', this.securityContext.userId),
      __.has('accessLevel', 'admin')
    );
    
    const canDelete = await checkTraversal.hasNext();
    if (!canDelete) {
      throw new Error('Insufficient permissions to delete this vertex');
    }
    
    // Delete vertex and all its edges
    await g.V(id).drop().next();
    return true;
  }
  
  /**
   * Share vertex with users or teams
   */
  async shareVertex(id: string, shareWith: string[], visibility: VisibilityLevel = 'shared'): Promise<boolean> {
    const g = getGraphTraversalSource();
    
    // Check if user has admin access to share using Neptune's internal ID
    let checkTraversal = g.V(id);
    checkTraversal = this.applySecurityFilter(checkTraversal);
    checkTraversal = checkTraversal.has('accessLevel', P.within('write', 'admin'));
    
    const canShare = await checkTraversal.hasNext();
    if (!canShare) {
      throw new Error('Insufficient permissions to share this vertex');
    }
    
    // Update sharing
    let traversal = g.V(id)
      .property('visibility', visibility);
    
    for (const userId of shareWith) {
      traversal = traversal.property(gremlinProcess.cardinality.set, 'sharedWith', userId);
    }
    
    await traversal.next();
    return true;
  }
  
  /**
   * Map Gremlin vertex to TypeScript type
   * Works with valueMap(true) format which returns arrays for all properties
   */
  private mapVertexToType<T extends KnowledgeVertex>(vertexData: any): T {
    if (!vertexData) {
      throw new Error('No vertex data to map');
    }
    
    const properties: any = {};
    
    // Process all properties from valueMap(true) format
    for (const [key, value] of Object.entries(vertexData)) {
      if (key === 'id') {
        // id is special - always single value
        properties.id = Array.isArray(value) ? value[0] : value;
      } else if (key === 'label') {
        // label maps to type field
        properties.type = Array.isArray(value) ? value[0] : value;
      } else if (Array.isArray(value)) {
        // valueMap returns arrays for all properties
        // If array has multiple values, keep as array; otherwise unwrap
        properties[key] = value.length > 1 ? value : value[0];
      } else {
        // Already a single value (shouldn't happen with valueMap but handle it)
        properties[key] = value;
      }
    }
    
    // Parse JSON strings for metadata/config fields
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === 'string' && (key === 'metadata' || key.endsWith('Config'))) {
        try {
          properties[key] = JSON.parse(value);
        } catch {
          // Keep as string if not valid JSON
        }
      }
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
    
    // Check that user has access to both vertices using Neptune's internal IDs
    let fromCheck = g.V(fromVertexId);
    fromCheck = this.applySecurityFilter(fromCheck);
    
    let toCheck = g.V(toVertexId);
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
    
    let traversal = g.V(fromVertexId)
      .addE(edge.type)
      .to(statics.V(toVertexId))
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
    
    // Check vertex access using Neptune's internal ID
    let vertexCheck = g.V(vertexId);
    vertexCheck = this.applySecurityFilter(vertexCheck);
    
    const canAccess = await vertexCheck.hasNext();
    if (!canAccess) {
      return [];
    }
    
    // Get edges with properties using valueMap(true)
    let traversal = g.V(vertexId);
    
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
    
    // Apply security filter to start vertex using Neptune's internal ID
    let traversal = g.V(startVertexId);
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

  /**
   * Analyze dependencies in a specific direction
   */
  async analyzeDependencies(
    startVertexId: string,
    direction: 'in' | 'out' | 'both',
    edgeTypes: string[],
    maxDepth: number,
    includeIndirect: boolean
  ): Promise<{ nodes: any[]; directCount: number }> {
    const g = getReadGraphTraversalSource();
    const nodes: any[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number; path: string[] }> = [
      { id: startVertexId, level: 0, path: [] }
    ];
    let directCount = 0;

    while (queue.length > 0) {
      const { id, level, path } = queue.shift()!;
      
      if (visited.has(id) || level > maxDepth) {
        continue;
      }
      visited.add(id);

      if (level > 0) {
        // Get vertex details with security filter
        let vertexTraversal = g.V(id);
        vertexTraversal = this.vertices['applySecurityFilter'](vertexTraversal);
        const vertex = await vertexTraversal.elementMap().next();

        if (vertex.value) {
          // Get direct dependencies
          let depTraversal = g.V(id);
          if (direction === 'out' || direction === 'both') {
            depTraversal = depTraversal.out(...edgeTypes);
          } else if (direction === 'in') {
            depTraversal = depTraversal.in_(...edgeTypes);
          }
          depTraversal = this.vertices['applySecurityFilter'](depTraversal);
          const directDeps = await depTraversal.id().toList();

          nodes.push({
            id: vertex.value.id,
            name: vertex.value.name || 'Unknown',
            type: vertex.value.label || vertex.value.type || 'Unknown',
            level,
            directDependencies: directDeps,
            path: [...path, id],
          });

          if (level === 1) {
            directCount++;
          }
        }
      }

      if (includeIndirect || level === 0) {
        // Get connected vertices
        let connectedTraversal = g.V(id);
        if (direction === 'out') {
          connectedTraversal = connectedTraversal.out(...edgeTypes);
        } else if (direction === 'in') {
          connectedTraversal = connectedTraversal.in_(...edgeTypes);
        } else {
          connectedTraversal = connectedTraversal.both(...edgeTypes);
        }
        connectedTraversal = this.vertices['applySecurityFilter'](connectedTraversal);
        const connected = await connectedTraversal.id().toList();

        for (const connectedId of connected) {
          if (!visited.has(connectedId as string)) {
            queue.push({ 
              id: connectedId as string, 
              level: level + 1,
              path: level === 0 ? [startVertexId] : [...path, id]
            });
          }
        }
      }
    }

    return { nodes, directCount };
  }

  /**
   * Detect circular dependencies
   */
  async detectCircularDependencies(
    startVertexId: string,
    edgeTypes: string[],
    maxDepth: number
  ): Promise<string[][]> {
    const g = getReadGraphTraversalSource();
    const circles: string[][] = [];
    
    try {
      // Find paths that lead back to the starting vertex
      let traversal = g.V(startVertexId).as('start');
      
      // Build repeat traversal
      traversal = traversal.repeat(
        statics.out(...edgeTypes).simplePath()
      ).times(maxDepth);
      
      // Check if any outgoing edge leads back to start
      traversal = traversal.where(
        statics.out(...edgeTypes).as('start')
      );
      
      // Get the paths
      const paths = await traversal.path().by('id').limit(10).toList();
      
      for (const path of paths) {
        if (path && (path as any).objects) {
          circles.push((path as any).objects as string[]);
        }
      }
    } catch (error) {
      console.warn("Circular dependency detection warning:", error);
    }

    return circles;
  }

  /**
   * Analyze impact of changes to a vertex
   */
  async analyzeImpact(
    vertexId: string,
    changeType: 'modify' | 'delete' | 'deprecate',
    maxDepth: number
  ): Promise<any> {
    const g = getReadGraphTraversalSource();
    
    // Get all vertices that depend on this one
    const impactedVertices = await this.analyzeDependencies(
      vertexId,
      'in',
      ['DEPENDS_ON', 'CALLS', 'USES', 'IMPLEMENTS', 'EXTENDS', 'REFERENCES'],
      maxDepth,
      true
    );

    // Categorize impact by severity
    const impact = {
      critical: [] as any[],
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
    };

    for (const vertex of impactedVertices.nodes) {
      const severity = this.calculateImpactSeverity(vertex, changeType);
      impact[severity].push({
        ...vertex,
        impactType: this.determineImpactType(vertex.type, changeType),
        severity,
      });
    }

    return impact;
  }

  /**
   * Calculate impact severity based on vertex properties and change type
   */
  private calculateImpactSeverity(
    vertex: any,
    changeType: string
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Direct dependencies are more critical
    if (vertex.level === 1) {
      if (changeType === 'delete') return 'critical';
      if (changeType === 'deprecate') return 'high';
      return 'medium';
    }
    
    // Indirect dependencies
    if (vertex.level === 2) {
      if (changeType === 'delete') return 'high';
      return 'medium';
    }
    
    // Far dependencies
    return 'low';
  }

  /**
   * Determine the type of impact based on vertex type
   */
  private determineImpactType(vertexType: string, changeType: string): string {
    if (changeType === 'delete') {
      return 'Breaking change - requires refactoring';
    }
    if (changeType === 'deprecate') {
      return 'Deprecated - plan migration';
    }
    if (vertexType === 'Function' || vertexType === 'Endpoint') {
      return 'API change - review implementation';
    }
    if (vertexType === 'Model' || vertexType === 'Component') {
      return 'Structure change - validate compatibility';
    }
    return 'Review for compatibility';
  }

  /**
   * Detect patterns in the graph
   */
  async detectPatterns(
    domain?: string,
    project?: string,
    minOccurrences: number = 2
  ): Promise<any[]> {
    const g = getReadGraphTraversalSource();
    const patterns: any[] = [];
    
    // Build base query with security
    let baseQuery = g.V();
    baseQuery = this.vertices['applySecurityFilter'](baseQuery);
    
    if (domain) {
      baseQuery = baseQuery.has('domain', domain);
    }
    if (project) {
      baseQuery = baseQuery.has('project', project);
    }
    
    // Find common subgraph patterns
    // This is a simplified version - real pattern detection would be more complex
    
    // Pattern 1: Functions that call multiple other functions
    const hubFunctions = await baseQuery
      .hasLabel('Function')
      .where(statics.out('CALLS').count().is(P.gte(3)))
      .elementMap()
      .toList();
    
    if (hubFunctions.length >= minOccurrences) {
      patterns.push({
        type: 'Hub Function',
        description: 'Functions that orchestrate multiple other functions',
        occurrences: hubFunctions,
        count: hubFunctions.length,
      });
    }
    
    // Pattern 2: Layered architecture (functions in one layer only call next layer)
    const layeredCalls = await baseQuery
      .hasLabel('Function')
      .has('layer')
      .group()
      .by('layer')
      .by(statics.out('CALLS').values('layer').dedup().fold())
      .toList();
    
    // Pattern 3: Circular dependencies
    const circularPatterns = await this.findCircularPatterns(domain, project);
    if (circularPatterns.length >= minOccurrences) {
      patterns.push({
        type: 'Circular Dependencies',
        description: 'Components with circular dependency chains',
        occurrences: circularPatterns,
        count: circularPatterns.length,
      });
    }
    
    return patterns;
  }

  /**
   * Find circular dependency patterns
   */
  private async findCircularPatterns(
    domain?: string,
    project?: string
  ): Promise<any[]> {
    const g = getReadGraphTraversalSource();
    const patterns: any[] = [];
    
    try {
      let baseQuery = g.V();
      baseQuery = this.vertices['applySecurityFilter'](baseQuery);
      
      if (domain) baseQuery = baseQuery.has('domain', domain);
      if (project) baseQuery = baseQuery.has('project', project);
      
      // Find vertices involved in cycles
      const cycles = await baseQuery
        .as('start')
        .repeat(statics.out('DEPENDS_ON', 'CALLS', 'USES').simplePath())
        .times(5)
        .where(statics.out('DEPENDS_ON', 'CALLS', 'USES').as('start'))
        .select('start')
        .dedup()
        .elementMap()
        .limit(20)
        .toList();
      
      patterns.push(...cycles);
    } catch (error) {
      console.warn("Pattern detection warning:", error);
    }
    
    return patterns;
  }
}