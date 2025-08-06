// Base knowledge node interface
export interface KnowledgeNode {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  project: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

// Specific node types
export type NodeType = "Function" | "Model" | "Architecture" | "CodePattern" | "Project" | "Domain";

export interface FunctionNode extends KnowledgeNode {
  type: "Function";
  filePath: string;
  signature?: string;
  isExported: boolean;
  isAsync: boolean;
  lineNumber?: number;
  returnType?: string;
  parameters?: string; // JSON string
}

export interface ModelNode extends KnowledgeNode {
  type: "Model";
  filePath: string;
  modelType: "interface" | "type" | "class" | "enum";
  properties?: string; // JSON string
  extendsFrom?: string;
}

export interface ArchitectureNode extends KnowledgeNode {
  type: "Architecture";
  purpose: string;
  implementation?: string;
  fileStructure?: string; // JSON string
  exampleFiles?: string;
  constraints?: string;
}

export interface CodePatternNode extends KnowledgeNode {
  type: "CodePattern";
  patternType: string; // 'react', 'redux', 'utility', 'testing', etc.
  useCase: string;
  implementation?: string;
  exampleCode?: string;
  antiPatterns?: string;
  relatedFiles?: string;
}

export interface ProjectNode extends KnowledgeNode {
  type: "Project";
  repoPath: string;
  technology: string;
  framework?: string;
}

export interface DomainNode extends KnowledgeNode {
  type: "Domain";
  topic: string;
  category: string;
  title: string;
  keyConcepts?: string; // JSON array
  examples?: string;
  formulas?: string;
  relatedTopics?: string;
  sources?: string;
}

// Relationship types
export interface KnowledgeRelationship {
  id: string;
  type: RelationshipType;
  source: string; // Node ID
  target: string; // Node ID
  properties?: Record<string, unknown>;
}

export type RelationshipType = 
  | "CALLS"
  | "USES" 
  | "BELONGS_TO"
  | "IMPLEMENTS"
  | "EXTENDS"
  | "CONTAINS"
  | "REFERENCES"
  | "APPLIES_TO"
  | "RELATED_TO"
  | "DEPENDS_ON";

// Search and query interfaces
export interface SearchQuery {
  query: string;
  types?: NodeType[];
  projects?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  node: KnowledgeNode;
  score: number;
  highlights?: string[];
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  facets: {
    types: Record<NodeType, number>;
    projects: Record<string, number>;
  };
}

// Graph visualization interfaces
export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  properties: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphRelationship {
  source: string;
  target: string;
  type: RelationshipType;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  metadata: {
    nodeCount: number;
    relationshipCount: number;
    nodeTypes: Record<NodeType, number>;
    relationshipTypes: Record<RelationshipType, number>;
  };
}