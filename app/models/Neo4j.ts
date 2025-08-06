import type { Node, Relationship, Integer } from "neo4j-driver";

// Neo4j driver configuration
export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

// Neo4j query result types
export interface Neo4jQueryResult<T = Record<string, unknown>> {
  records: T[];
  summary: {
    query: string;
    parameters?: Record<string, unknown>;
    counters: {
      nodesCreated: number;
      nodesDeleted: number;
      relationshipsCreated: number;
      relationshipsDeleted: number;
      propertiesSet: number;
    };
  };
}

// Neo4j node and relationship type wrappers
export interface Neo4jNode<T = Record<string, unknown>> {
  identity: string;
  labels: string[];
  properties: T;
}

export interface Neo4jRelationship<T = Record<string, unknown>> {
  identity: string;
  type: string;
  start: string;
  end: string;
  properties: T;
}

// Utility functions for working with Neo4j types
export function formatNeo4jNode<T>(node: Node): Neo4jNode<T> {
  return {
    identity: node.identity.toString(),
    labels: node.labels,
    properties: node.properties as T,
  };
}

export function formatNeo4jRelationship<T>(rel: Relationship): Neo4jRelationship<T> {
  return {
    identity: rel.identity.toString(),
    type: rel.type,
    start: rel.start.toString(),
    end: rel.end.toString(),
    properties: rel.properties as T,
  };
}

export function formatNeo4jInteger(value: Integer): number {
  return value.toNumber();
}

// Common Cypher query patterns
export const CypherQueries = {
  // Node operations
  CREATE_NODE: (labels: string[], properties: Record<string, unknown>) => 
    `CREATE (n:${labels.join(':')} $properties) RETURN n`,
    
  FIND_NODE_BY_ID: (id: string) =>
    `MATCH (n) WHERE id(n) = $id RETURN n`,
    
  FIND_NODES_BY_LABEL: (label: string, limit = 50) =>
    `MATCH (n:${label}) RETURN n LIMIT ${limit}`,
    
  UPDATE_NODE: (id: string, properties: Record<string, unknown>) =>
    `MATCH (n) WHERE id(n) = $id SET n += $properties RETURN n`,
    
  DELETE_NODE: (id: string) =>
    `MATCH (n) WHERE id(n) = $id DETACH DELETE n`,

  // Relationship operations
  CREATE_RELATIONSHIP: (fromId: string, toId: string, type: string, properties?: Record<string, unknown>) =>
    `MATCH (a), (b) WHERE id(a) = $fromId AND id(b) = $toId 
     CREATE (a)-[r:${type}${properties ? ' $properties' : ''}]->(b) RETURN r`,
     
  FIND_RELATIONSHIPS: (nodeId: string, direction: 'IN' | 'OUT' | 'BOTH' = 'BOTH') => {
    const pattern = direction === 'IN' ? '<-[r]-' : direction === 'OUT' ? '-[r]->' : '-[r]-';
    return `MATCH (n)${pattern}(m) WHERE id(n) = $nodeId RETURN r, m`;
  },

  // Search operations
  FULL_TEXT_SEARCH: (query: string, labels?: string[], limit = 20) => {
    const labelFilter = labels ? `:${labels.join(':')}` : '';
    return `CALL db.index.fulltext.queryNodes('search_index', $query) 
            YIELD node, score 
            WHERE node${labelFilter}
            RETURN node, score 
            ORDER BY score DESC 
            LIMIT ${limit}`;
  },

  // Graph traversal
  EXPAND_FROM_NODE: (nodeId: string, depth = 2, relationshipTypes?: string[]) => {
    const relFilter = relationshipTypes ? `:${relationshipTypes.join('|')}` : '';
    return `MATCH path = (start)-[${relFilter}*1..${depth}]-(end) 
            WHERE id(start) = $nodeId 
            RETURN nodes(path) as nodes, relationships(path) as relationships`;
  },

  // Statistics
  COUNT_NODES_BY_LABEL: () =>
    `MATCH (n) RETURN labels(n) as labels, count(n) as count`,
    
  COUNT_RELATIONSHIPS_BY_TYPE: () =>
    `MATCH ()-[r]->() RETURN type(r) as type, count(r) as count`,
} as const;