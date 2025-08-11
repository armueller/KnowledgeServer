import { z } from 'zod';

// ============== Search & Discovery Tools ==============
// Note: Search API is type-specific, not general text search

export const SearchByDomainSchema = z.object({
  domain: z.string().describe('Domain to search within'),
  project: z.string().optional().describe('Optional project to filter results'),
  limit: z.number().min(1).max(100).default(50).describe('Maximum results'),
  offset: z.number().min(0).default(0).describe('Pagination offset'),
  orderBy: z.string().default('name').describe('Field to order by'),
  orderDirection: z.enum(['ASC', 'DESC']).default('ASC').describe('Sort direction'),
});

export const SearchByTagSchema = z.object({
  tag: z.string().describe('Tag to search for'),
  project: z.string().optional().describe('Optional project to filter results'),
  limit: z.number().min(1).max(100).default(50).describe('Maximum results'),
  offset: z.number().min(0).default(0).describe('Pagination offset'),
  orderBy: z.string().default('name').describe('Field to order by'),
  orderDirection: z.enum(['ASC', 'DESC']).default('ASC').describe('Sort direction'),
});

export const SearchByProjectSchema = z.object({
  project: z.string().describe('Project to search within'),
  limit: z.number().min(1).max(100).default(50).describe('Maximum results'),
  offset: z.number().min(0).default(0).describe('Pagination offset'),
  orderBy: z.string().default('name').describe('Field to order by'),
  orderDirection: z.enum(['ASC', 'DESC']).default('ASC').describe('Sort direction'),
});

export const GraphTraversalSchema = z.object({
  startId: z.string().describe('Starting vertex ID for traversal'),
  depth: z.number().min(1).max(10).default(2).describe('Traversal depth'),
  edgeTypes: z.array(z.string()).optional().describe('Edge types to follow'),
  limit: z.number().min(1).max(100).default(100).describe('Maximum paths to return'),
});

export const ListVerticesSchema = z.object({
  type: z.string().optional().describe('Filter by vertex type'),
  domain: z.string().optional().describe('Filter by domain'),
  project: z.string().optional().describe('Filter by project'),
  limit: z.number().min(1).max(100).default(50).describe('Maximum results'),
  offset: z.number().min(0).default(0).describe('Pagination offset'),
});

// ============== Detail Retrieval Tools ==============

export const GetVertexSchema = z.object({
  id: z.string().describe('Vertex ID to retrieve'),
});

export const GetEdgesSchema = z.object({
  from: z.string().describe('Source vertex ID'),
  edgeTypes: z.array(z.string()).optional().describe('Filter by edge types'),
});

export const TraverseFromVertexSchema = z.object({
  from: z.string().describe('Starting vertex ID'),
  depth: z.number().min(1).max(10).default(2).describe('Traversal depth'),
  edgeTypes: z.array(z.string()).optional().describe('Edge types to follow'),
});

// ============== Analysis Tools ==============

export const AnalyzeDependenciesSchema = z.object({
  vertexId: z.string().describe('Vertex ID to analyze'),
  direction: z.enum(['forward', 'reverse', 'both']).default('both').describe('Dependency direction'),
  maxDepth: z.number().min(1).max(10).default(5).describe('Maximum traversal depth'),
  includeIndirect: z.boolean().default(true).describe('Include transitive dependencies'),
  edgeTypes: z.array(z.string()).optional().describe('Edge types to consider'),
});

export const AnalyzeImpactSchema = z.object({
  vertexId: z.string().describe('Vertex ID to analyze impact for'),
  changeType: z.enum(['modify', 'delete', 'deprecate']).default('modify').describe('Type of change'),
  maxDepth: z.number().min(1).max(10).default(3).describe('Maximum impact depth'),
  includeSeverity: z.boolean().default(true).describe('Include severity analysis'),
});

export const DetectPatternsSchema = z.object({
  domain: z.string().optional().describe('Filter by domain'),
  project: z.string().optional().describe('Filter by project'),
  patternType: z.string().optional().describe('Specific pattern type to detect'),
  minOccurrences: z.number().min(1).default(2).describe('Minimum pattern occurrences'),
  similarity: z.number().min(0).max(1).default(0.8).describe('Similarity threshold'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum patterns to return'),
});

// ============== Knowledge Management Tools (CRUD) ==============

// Common fields for all vertices
const BaseVertexSchema = z.object({
  name: z.string().describe('Unique name within context'),
  description: z.string().default('').describe('Human-readable description'),
  project: z.string().default('unknown').describe('Project association'),
  domain: z.string().default('general').describe('Domain classification'),
  visibility: z.enum(['private', 'team', 'organization']).default('private'),
  accessLevel: z.enum(['read', 'write', 'admin']).default('write'),
  tags: z.array(z.string()).default([]).describe('Searchable tags'),
  keywords: z.array(z.string()).default([]).describe('Search keywords'),
  status: z.enum(['draft', 'active', 'deprecated', 'experimental']).default('active'),
  confidence: z.number().min(0).max(1).default(1.0),
  version: z.string().default('1.0.0'),
});

// Function-specific fields
export const CreateFunctionSchema = BaseVertexSchema.extend({
  type: z.literal('Function'),
  filePath: z.string().default(''),
  signature: z.string().default(''),
  isAsync: z.boolean().default(false),
  isPure: z.boolean().default(false),
  lineStart: z.number().default(0),
  lineEnd: z.number().default(0),
  returnType: z.string().default('void'),
  parameters: z.array(z.string()).default([]),
  sideEffects: z.array(z.string()).default([]),
});

// Model-specific fields
export const CreateModelSchema = BaseVertexSchema.extend({
  type: z.literal('Model'),
  filePath: z.string().default(''),
  lineStart: z.number().default(0),
  lineEnd: z.number().default(0),
  modelType: z.string().default('interface'),
  properties: z.array(z.string()).default([]),
  methods: z.array(z.string()).default([]),
  extends: z.string().optional(),
  implements: z.string().optional(),
});

// Pattern-specific fields
export const CreatePatternSchema = BaseVertexSchema.extend({
  type: z.literal('Pattern'),
  patternType: z.string().default('design'),
  problem: z.string().default(''),
  solution: z.string().default(''),
  examples: z.array(z.string()).default([]),
  antiPatterns: z.array(z.string()).default([]),
});

// System-specific fields
export const CreateSystemSchema = BaseVertexSchema.extend({
  type: z.literal('System'),
  systemDomain: z.string().default(''),
  boundaries: z.array(z.string()).default([]),
  interfaces: z.array(z.string()).default([]),
  contracts: z.array(z.string()).default([]),
});

// Concept-specific fields
export const CreateConceptSchema = BaseVertexSchema.extend({
  type: z.literal('Concept'),
  conceptType: z.string().default('general'),
  definition: z.string().default(''),
  examples: z.array(z.string()).default([]),
  relationships: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
});

// Union type for any vertex creation
export const CreateVertexSchema = z.discriminatedUnion('type', [
  CreateFunctionSchema,
  CreateModelSchema,
  CreatePatternSchema,
  CreateSystemSchema,
  CreateConceptSchema,
]);

export const UpdateVertexSchema = z.object({
  id: z.string().describe('Vertex ID to update'),
  updates: z.record(z.any()).describe('Fields to update'),
});

export const DeleteVertexSchema = z.object({
  id: z.string().describe('Vertex ID to delete'),
});

// ============== Relationship Management ==============

export const CreateEdgeSchema = z.object({
  fromVertexId: z.string().describe('Source vertex ID'),
  toVertexId: z.string().describe('Target vertex ID'),
  type: z.enum([
    'BELONGS_TO', 'CALLS', 'USES', 'IMPLEMENTS', 
    'DEPENDS_ON', 'EXTENDS', 'REFERENCES', 'CONTAINS'
  ]).describe('Edge type'),
  visibility: z.enum(['private', 'team', 'organization']).describe('Edge visibility'),
  // BELONGS_TO specific fields
  role: z.string().optional().describe('Role in relationship (for BELONGS_TO)'),
  responsibilities: z.array(z.string()).optional().describe('Responsibilities (for BELONGS_TO)'),
});

// Type exports
export type SearchByDomain = z.infer<typeof SearchByDomainSchema>;
export type SearchByTag = z.infer<typeof SearchByTagSchema>;
export type SearchByProject = z.infer<typeof SearchByProjectSchema>;
export type GraphTraversal = z.infer<typeof GraphTraversalSchema>;
export type ListVertices = z.infer<typeof ListVerticesSchema>;
export type GetVertex = z.infer<typeof GetVertexSchema>;
export type GetEdges = z.infer<typeof GetEdgesSchema>;
export type TraverseFromVertex = z.infer<typeof TraverseFromVertexSchema>;
export type AnalyzeDependencies = z.infer<typeof AnalyzeDependenciesSchema>;
export type AnalyzeImpact = z.infer<typeof AnalyzeImpactSchema>;
export type DetectPatterns = z.infer<typeof DetectPatternsSchema>;
export type CreateFunction = z.infer<typeof CreateFunctionSchema>;
export type CreateModel = z.infer<typeof CreateModelSchema>;
export type CreatePattern = z.infer<typeof CreatePatternSchema>;
export type CreateSystem = z.infer<typeof CreateSystemSchema>;
export type CreateConcept = z.infer<typeof CreateConceptSchema>;
export type CreateVertex = z.infer<typeof CreateVertexSchema>;
export type UpdateVertex = z.infer<typeof UpdateVertexSchema>;
export type DeleteVertex = z.infer<typeof DeleteVertexSchema>;
export type CreateEdge = z.infer<typeof CreateEdgeSchema>;