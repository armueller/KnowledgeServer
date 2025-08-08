/**
 * TypeScript interfaces for Neptune graph database schema
 * Based on comprehensive knowledge graph schema design with multi-tenant security
 */

// ========== SECURITY & MULTI-TENANCY TYPES ==========

export type VisibilityLevel = 'private' | 'team' | 'organization' | 'shared';
export type AccessLevel = 'read' | 'write' | 'admin';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'active' | 'deprecated' | 'experimental' | 'archived';

// ========== EXTENSIBILITY TYPES ==========

// Make enums extensible by using string with known values
// This allows runtime flexibility while maintaining TypeScript hints
export type IntegrationType = 'API' | 'queue' | 'event' | 'webhook' | 'database' | 'file' | string;
export type ComponentType = 'UI' | 'service' | 'utility' | 'library' | 'middleware' | string;
export type ModelType = 'class' | 'interface' | 'enum' | 'type' | 'namespace' | string;
export type LayerType = 'presentation' | 'business' | 'data' | 'infrastructure' | 'cross-cutting' | string;

// Schema versioning for migrations
export const SCHEMA_VERSION = '1.0.0';

// ========== UNIVERSAL PROPERTIES ==========

export interface BaseVertex {
  // Identity
  id: string;
  name: string;
  type: string;
  
  // Multi-Tenancy & Security (CRITICAL)
  tenantId: string;              // Organization/company identifier
  userId: string;                // Creating user identifier  
  teamId?: string;               // Team identifier (for team collaboration)
  visibility: VisibilityLevel;   // private|team|organization|shared
  accessLevel: AccessLevel;      // read|write|admin
  sharedWith?: string[];         // Explicit user/team shares
  
  // Context
  project: string;               // Project/repository name
  domain: string;                // Business domain
  layer?: string;                // Architectural layer
  team?: string;                 // Owning team (descriptive)
  
  // Metadata
  createdAt: number;             // timestamp
  updatedAt: number;             // timestamp
  createdBy: string;             // Author
  updatedBy: string;             // Last modifier
  version: string;               // Version/commit
  
  // Discovery
  tags: string[];                // Searchable tags
  keywords: string[];            // Search terms
  description: string;           // Human description
  summary?: string;              // Brief overview
  
  // Quality
  status: Status;                // active|deprecated|experimental|archived
  confidence: number;            // 0.0-1.0 reliability score
  complexity?: number;           // Cyclomatic/cognitive complexity
  quality?: number;              // Quality score
  
  // Business
  businessValue?: string;        // Business justification
  priority?: Priority;           // critical|high|medium|low
  owner?: string;                // Business owner
  costCenter?: string;           // Financial attribution
  
  // Extensibility
  schemaVersion: string;         // Schema version for migrations
  customType?: string;           // User-defined type extension
  metadata?: Record<string, any>; // Flexible key-value storage for extensions
}

// ========== SECURITY CONTEXT ==========

export interface SecurityContext {
  tenantId: string;
  userId: string;
  teamIds: string[];
  accessLevels: AccessLevel[];
  isAdmin: boolean;
}

export interface SecurityFilter {
  tenantId: string;
  userId: string;
  teamIds: string[];
  includeShared?: boolean;
}

// ========== CODE ARTIFACTS BASE ==========

// Shared properties for all code-related vertices
export interface CodeArtifactBase extends BaseVertex {
  filePath: string;              // File location
  lineStart: number;             // Starting line number
  lineEnd: number;               // Ending line number
  commitHash?: string;           // Git commit for version tracking
  language?: string;             // Programming language
  repository?: string;           // Repository name/URL
}

// ========== CODE ARTIFACTS VERTICES ==========

export interface FunctionVertex extends CodeArtifactBase {
  type: 'Function';
  signature: string;
  parameters: string[];
  returnType: string;
  sideEffects: string[];
  isAsync: boolean;
  isPure: boolean;
}

export interface ModelVertex extends CodeArtifactBase {
  type: 'Model';
  modelType: ModelType;          // Now extensible
  properties: string[];
  methods: string[];
  extends?: string[];
  implements?: string[];
}

export interface ComponentVertex extends CodeArtifactBase {
  type: 'Component';
  componentType: ComponentType;   // Now extensible
  exports: string[];
  dependencies: string[];
  lifecycle: string[];
}

export interface EndpointVertex extends CodeArtifactBase {
  type: 'Endpoint';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | string; // Extensible
  path: string;
  requestSchema?: string;
  responseSchema?: string;
  authentication: boolean;
  rateLimit?: string;
}

export interface ConfigurationVertex extends BaseVertex {
  type: 'Configuration';
  environment: string;
  defaultValue?: string;
  validation?: string;
  sensitive: boolean;
  dynamic: boolean;
  filePath?: string;             // Optional for non-file configs
  lineStart?: number;
  lineEnd?: number;
}

// ========== ARCHITECTURAL ELEMENTS VERTICES ==========

export interface LayerVertex extends BaseVertex {
  type: 'Layer';
  layerType: LayerType;          // Now extensible
  responsibilities: string[];
  boundaries: string[];
  layerDependencies: string[];
}

export interface ServiceVertex extends BaseVertex {
  type: 'Service';
  serviceType: string;            // Already flexible
  protocol: string;
  sla?: string;
  scaling?: string;
  deployment?: string;
}

export interface SystemVertex extends BaseVertex {
  type: 'System';
  systemDomain: string;
  boundaries: string[];
  interfaces: string[];
  contracts: string[];
}

export interface IntegrationVertex extends BaseVertex {
  type: 'Integration';
  integrationType: IntegrationType; // Now extensible
  protocol: string;
  format: string;
  retry?: string;
  fallback?: string;
}

export interface DatabaseVertex extends BaseVertex {
  type: 'Database';
  databaseType: string;
  schema?: string;
  indexes: string[];
  partitioning?: string;
  replication?: string;
}

// ========== KNOWLEDGE & DECISIONS VERTICES ==========

export interface DecisionVertex extends BaseVertex {
  type: 'Decision';
  context: string;
  decision: string;
  consequences: string[];
  alternatives: string[];
  decisionStatus: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  date: number; // timestamp
}

export interface PatternVertex extends BaseVertex {
  type: 'Pattern';
  patternType: 'design' | 'architectural' | 'code';
  problem: string;
  solution: string;
  examples: string[];
  antiPatterns: string[];
}

export interface ConstraintVertex extends BaseVertex {
  type: 'Constraint';
  constraintType: 'technical' | 'business' | 'regulatory';
  impact: string;
  workarounds: string[];
  validation?: string;
}

export interface ProblemVertex extends BaseVertex {
  type: 'Problem';
  impact: string;
  solutions: string[];
  alternatives: string[];
  tradeoffs: string[];
}

export interface ConceptVertex extends BaseVertex {
  type: 'Concept';
  conceptType: string;
  definition: string;
  examples: string[];
  relationships: string[];
  synonyms: string[];
}

// ========== OPERATIONAL INTELLIGENCE VERTICES ==========

export interface IncidentVertex extends BaseVertex {
  type: 'Incident';
  severity: Priority;
  rootCause: string;
  impact: string;
  resolution: string;
  prevention: string[];
  timeline: number[]; // timestamps
}

export interface PerformanceVertex extends BaseVertex {
  type: 'Performance';
  metric: string;
  baseline?: number;
  target?: number;
  bottleneck: boolean;
  optimization?: string[];
  benchmark?: string;
}

export interface SecurityVertex extends BaseVertex {
  type: 'Security';
  securityType: string;
  severity: Priority;
  mitigation: string[];
  compliance: string[];
  auditLog: string[];
  lastReview: number; // timestamp
}

export interface DeploymentVertex extends BaseVertex {
  type: 'Deployment';
  environment: string;
  strategy: string;
  rollback?: string;
  healthChecks: string[];
  deploymentDependencies: string[];
}

export interface MonitoringVertex extends BaseVertex {
  type: 'Monitoring';
  metrics: string[];
  alerts: string[];
  dashboards: string[];
  slos: string[];
  runbooks: string[];
}

// ========== BUSINESS CONTEXT VERTICES ==========

export interface FeatureVertex extends BaseVertex {
  type: 'Feature';
  requirements: string[];
  acceptanceCriteria: string[];
  userStory: string;
  featurePriority: Priority;
  release?: string;
}

export interface UseCaseVertex extends BaseVertex {
  type: 'UseCase';
  actors: string[];
  flow: string[];
  preconditions: string[];
  postconditions: string[];
  exceptions: string[];
}

export interface BusinessRuleVertex extends BaseVertex {
  type: 'BusinessRule';
  rule: string;
  validation: string[];
  calculation?: string;
  exceptions: string[];
  authority: string;
}

export interface StakeholderVertex extends BaseVertex {
  type: 'Stakeholder';
  role: string;
  responsibilities: string[];
  concerns: string[];
  contactInfo?: string;
  decisions: string[];
}

export interface MetricVertex extends BaseVertex {
  type: 'Metric';
  formula: string;
  target?: number;
  current?: number;
  trend?: 'up' | 'down' | 'stable';
  metricImpact: string;
  metricOwner: string;
}

// ========== DEVELOPMENT CONTEXT VERTICES ==========

export interface ConventionVertex extends BaseVertex {
  type: 'Convention';
  conventionType: 'naming' | 'formatting' | 'architectural';
  rule: string;
  examples: string[];
  exceptions: string[];
  rationale: string;
}

export interface WorkflowVertex extends BaseVertex {
  type: 'Workflow';
  steps: string[];
  tools: string[];
  triggers: string[];
  approvals: string[];
  automation?: string[];
}

export interface ToolVertex extends BaseVertex {
  type: 'Tool';
  toolVersion: string;
  license: string;
  purpose: string;
  alternatives: string[];
  migration?: string;
}

export interface DocumentationVertex extends BaseVertex {
  type: 'Documentation';
  docType: string;
  audience: string[];
  format: string;
  location: string;
  maintainer: string;
}

export interface TestStrategyVertex extends BaseVertex {
  type: 'TestStrategy';
  testType: string[];
  coverage: number;
  testTools: string[];
  testData: string[];
  environments: string[];
}

// ========== CUSTOM VERTEX TYPE ==========

// Allow users to define completely custom vertex types
export interface CustomVertex extends BaseVertex {
  type: 'Custom';
  customType: string;             // User-defined type name
  category: string;               // Category for organization
  properties: Record<string, any>; // Flexible properties
}

// ========== UNION TYPES FOR ALL VERTICES ==========

export type KnowledgeVertex = 
  // Code Artifacts
  | FunctionVertex
  | ModelVertex 
  | ComponentVertex
  | EndpointVertex
  | ConfigurationVertex
  // Architectural Elements
  | LayerVertex
  | ServiceVertex
  | SystemVertex
  | IntegrationVertex
  | DatabaseVertex
  // Knowledge & Decisions
  | DecisionVertex
  | PatternVertex
  | ConstraintVertex
  | ProblemVertex
  | ConceptVertex
  // Operational Intelligence
  | IncidentVertex
  | PerformanceVertex
  | SecurityVertex
  | DeploymentVertex
  | MonitoringVertex
  // Business Context
  | FeatureVertex
  | UseCaseVertex
  | BusinessRuleVertex
  | StakeholderVertex
  | MetricVertex
  // Development Context
  | ConventionVertex
  | WorkflowVertex
  | ToolVertex
  | DocumentationVertex
  | TestStrategyVertex
  // Extensibility
  | CustomVertex;

// ========== EDGE TYPES ==========

export interface BaseEdge {
  id: string;
  type: string;
  
  // Multi-Tenancy (inherit from source vertex)
  tenantId: string;
  userId: string;
  teamId?: string;
  visibility: VisibilityLevel;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
}

// Technical Relationships
export interface CallsEdge extends BaseEdge {
  type: 'CALLS';
  callType: 'sync' | 'async';
  frequency?: number;
  conditional: boolean;
}

export interface ImplementsEdge extends BaseEdge {
  type: 'IMPLEMENTS';
  conformance: number; // 0.0-1.0
  variations: string[];
}

export interface DependsOnEdge extends BaseEdge {
  type: 'DEPENDS_ON';
  dependencyType: 'compile' | 'runtime';
  strength: 'weak' | 'strong';
}

export interface ModifiesEdge extends BaseEdge {
  type: 'MODIFIES';
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  fields: string[];
  validation: string[];
}

export interface ValidatesEdge extends BaseEdge {
  type: 'VALIDATES';
  rules: string[];
  errorHandling: string[];
}

export interface TransformsEdge extends BaseEdge {
  type: 'TRANSFORMS';
  from: string;
  to: string;
  mapping: string[];
}

// Architectural Relationships
export interface BelongsToEdge extends BaseEdge {
  type: 'BELONGS_TO';
  role: string;
  responsibilities: string[];
}

export interface CommunicatesWithEdge extends BaseEdge {
  type: 'COMMUNICATES_WITH';
  protocol: string;
  format: string;
  async: boolean;
}

export interface DeployedInEdge extends BaseEdge {
  type: 'DEPLOYED_IN';
  deployVersion: string;
  config: string[];
  replicas: number;
}

export interface ScaledByEdge extends BaseEdge {
  type: 'SCALED_BY';
  trigger: string;
  min: number;
  max: number;
  policy: string;
}

export interface BackedByEdge extends BaseEdge {
  type: 'BACKED_BY';
  operations: string[];
  consistency: string;
}

// Knowledge Relationships
export interface SolvesEdge extends BaseEdge {
  type: 'SOLVES';
  effectiveness: number; // 0.0-1.0
  tradeoffs: string[];
}

export interface ConstrainedByEdge extends BaseEdge {
  type: 'CONSTRAINED_BY';
  constraintImpact: string;
  workaround?: string;
}

export interface SupersedesEdge extends BaseEdge {
  type: 'SUPERSEDES';
  reason: string;
  migration?: string;
}

export interface AlternativeToEdge extends BaseEdge {
  type: 'ALTERNATIVE_TO';
  comparison: string[];
  alternativeTradeoffs: string[];
}

export interface DerivedFromEdge extends BaseEdge {
  type: 'DERIVED_FROM';
  modifications: string[];
  rationale: string;
}

export interface DocumentedInEdge extends BaseEdge {
  type: 'DOCUMENTED_IN';
  section?: string;
  docVersion: string;
}

// Business Relationships
export interface ServesEdge extends BaseEdge {
  type: 'SERVES';
  functionality: string[];
  servePriority: Priority;
}

export interface MeasuresEdge extends BaseEdge {
  type: 'MEASURES';
  formula: string;
  frequency: string;
}

export interface AuthorizedByEdge extends BaseEdge {
  type: 'AUTHORIZED_BY';
  permissions: string[];
  conditions: string[];
}

export interface TriggersEdge extends BaseEdge {
  type: 'TRIGGERS';
  conditions: string[];
  triggerAsync: boolean;
}

export interface CostsEdge extends BaseEdge {
  type: 'COSTS';
  unit: string;
  usage?: number;
  optimization?: string[];
}

// Union type for all edges
export type KnowledgeEdge = 
  // Technical
  | CallsEdge
  | ImplementsEdge
  | DependsOnEdge
  | ModifiesEdge
  | ValidatesEdge
  | TransformsEdge
  // Architectural  
  | BelongsToEdge
  | CommunicatesWithEdge
  | DeployedInEdge
  | ScaledByEdge
  | BackedByEdge
  // Knowledge
  | SolvesEdge
  | ConstrainedByEdge
  | SupersedesEdge
  | AlternativeToEdge
  | DerivedFromEdge
  | DocumentedInEdge
  // Business
  | ServesEdge
  | MeasuresEdge
  | AuthorizedByEdge
  | TriggersEdge
  | CostsEdge;

// ========== HELPER TYPES ==========

export type VertexType = KnowledgeVertex['type'];
export type EdgeType = KnowledgeEdge['type'];

export interface GraphTraversal {
  vertices: KnowledgeVertex[];
  edges: KnowledgeEdge[];
  paths: GraphPath[];
}

export interface GraphPath {
  vertices: string[]; // vertex IDs
  edges: string[]; // edge IDs
  length: number;
}

export interface QueryResult<T = KnowledgeVertex> {
  data: T[];
  count: number;
  hasMore: boolean;
  cursor?: string;
  securityContext: SecurityContext;
}

// Query builder types with security
export interface SecureGraphQuery {
  // Security context (automatically applied)
  securityContext: SecurityContext;
  
  // Query filters
  vertexFilters?: Partial<KnowledgeVertex>;
  edgeFilters?: Partial<KnowledgeEdge>;
  
  // Pagination & ordering
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  
  // Graph traversal
  includeEdges?: boolean;
  traversalDepth?: number;
  
  // Visibility overrides (for admins)
  includePrivate?: boolean;
  specificTenant?: string;
}

// Team management types
export interface Team {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  members: TeamMember[];
  settings: TeamSettings;
}

export interface TeamMember {
  userId: string;
  teamId: string;
  role: 'member' | 'admin' | 'owner';
  joinedAt: number;
  permissions: string[];
}

export interface TeamSettings {
  defaultVisibility: VisibilityLevel;
  allowMemberInvites: boolean;
  requireApprovalForSharing: boolean;
  maxPrivateKnowledge?: number;
}

// Tenant/Organization management
export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  subscriptionPlan: 'free' | 'team' | 'enterprise';
  createdAt: number;
  settings: TenantSettings;
  limits: TenantLimits;
}

export interface TenantSettings {
  allowTeamCreation: boolean;
  defaultTeamSettings: TeamSettings;
  enforceDataRetention: boolean;
  dataRetentionDays?: number;
}

export interface TenantLimits {
  maxUsers: number;
  maxTeams: number;
  maxKnowledgeNodes: number;
  maxStorageGB: number;
}

// ========== SCHEMA HELPERS ==========

// Type for all code artifact vertices
type CodeArtifactVertex = FunctionVertex | ModelVertex | ComponentVertex | EndpointVertex | ConfigurationVertex;

// Type guards for vertex types
export function isCodeArtifact(vertex: KnowledgeVertex): vertex is CodeArtifactVertex {
  return 'filePath' in vertex && 'lineStart' in vertex && 'lineEnd' in vertex;
}

export function isCustomVertex(vertex: KnowledgeVertex): vertex is CustomVertex {
  return vertex.type === 'Custom' && 'customType' in vertex;
}

// Schema migration helper
export interface SchemaMigration {
  fromVersion: string;
  toVersion: string;
  migrate: (vertex: any) => any;
}

// Helper to check if a value needs migration
export function needsMigration(vertex: BaseVertex, targetVersion: string): boolean {
  return vertex.schemaVersion !== targetVersion;
}

// Registry for custom types (can be stored in Neptune)
export interface TypeRegistry {
  customVertexTypes: Map<string, {
    name: string;
    category: string;
    requiredProperties: string[];
    optionalProperties: string[];
    validator?: (vertex: CustomVertex) => boolean;
  }>;
  customEdgeTypes: Map<string, {
    name: string;
    requiredProperties: string[];
    optionalProperties: string[];
  }>;
}