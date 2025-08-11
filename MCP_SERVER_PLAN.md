# MCP Server Implementation Plan for KnowledgeServer

## Overview
Create a comprehensive MCP (Model Context Protocol) server that enables Claude to fully interact with the KnowledgeServer API, acting as a development assistant with complete CRUD capabilities for maintaining and utilizing the knowledge graph during active development.

## Core Requirements

### Authentication & Permissions
- **Initial Implementation**: Use username/password authentication (austin@tabus10.com)
- **Future**: Integrate with full auth system
- **Permissions**: Respect user-level permissions (MCP acts on behalf of the user)
- **Access Level**: Full CRUD operations (Create, Read, Update, Delete)

### Caching Strategy
- **Default TTL**: 5 minutes for search results
- **Vertex Details**: 10 minutes cache
- **Invalidation**: Clear cache on any update operations
- **Implementation**: LRU cache with configurable size limits

## Tool Set Design

### 1. Search & Discovery Tools

#### `search_knowledge`
```typescript
{
  query: string,              // Natural language or keywords
  types?: string[],           // Filter by vertex types (Function, Model, Pattern, etc.)
  domains?: string[],         // Filter by domains
  projects?: string[],        // Filter by projects
  limit?: number,             // Default: 10, max: 50
  includeRelated?: boolean,   // Include connected vertices
  onlyMine?: boolean          // Filter to user's own vertices
}
```
**Purpose**: Primary search tool for finding any knowledge in the graph

#### `find_by_name`
```typescript
{
  name: string,               // Exact or partial name match
  type?: string,              // Optional type filter
  fuzzy?: boolean,            // Enable fuzzy matching (default: true)
  project?: string            // Scope to specific project
}
```
**Purpose**: Quick lookup when you know the name

#### `list_by_type`
```typescript
{
  type: string,               // Vertex type to list
  project?: string,           // Optional project filter
  domain?: string,            // Optional domain filter
  limit?: number,             // Default: 20
  offset?: number             // For pagination
}
```
**Purpose**: Browse all items of a specific type

### 2. Detail Retrieval Tools

#### `get_details`
```typescript
{
  id?: string,                // Vertex ID (primary)
  name?: string,              // Alternative: lookup by name
  type?: string,              // Required with name lookup
  includeEdges?: boolean,     // Include relationships (default: true)
  depth?: number              // Relationship depth to fetch (default: 1)
}
```
**Purpose**: Get comprehensive information about a specific vertex

#### `get_code_context`
```typescript
{
  functionName: string,       // Function to get context for
  project?: string,           // Optional project scope
  includeCallers?: boolean,   // Include functions that call this
  includeCallees?: boolean,   // Include functions this calls
  includeSiblings?: boolean,  // Functions in same file/module
  includeModels?: boolean     // Include related data models
}
```
**Purpose**: Understand code in its full context

#### `get_relationships`
```typescript
{
  vertexId: string,           // Vertex to get relationships for
  direction?: 'in' | 'out' | 'both',  // Default: 'both'
  edgeTypes?: string[],       // Filter by edge types
  depth?: number              // How far to traverse (default: 1)
}
```
**Purpose**: Explore the connection graph around a vertex

### 3. Analysis Tools

#### `analyze_dependencies`
```typescript
{
  id: string,                 // Vertex to analyze
  direction?: 'forward' | 'reverse' | 'both',  // Default: 'both'
  maxDepth?: number,          // Default: 5
  includeCircular?: boolean,  // Detect circular dependencies
  includeIndirect?: boolean   // Include transitive dependencies
}
```
**Purpose**: Understand dependency chains and potential issues

#### `analyze_impact`
```typescript
{
  id: string,                 // Vertex to analyze
  changeType?: 'modify' | 'delete' | 'deprecate',  // Default: 'modify'
  maxDepth?: number,          // Default: 3
  severityFilter?: 'all' | 'critical' | 'high',    // Default: 'all'
  includeRecommendations?: boolean  // Get mitigation suggestions
}
```
**Purpose**: Assess the impact of potential changes

#### `detect_patterns`
```typescript
{
  domain?: string,            // Filter by domain
  project?: string,           // Filter by project
  patternTypes?: string[],    // Specific patterns to look for
  minConfidence?: number,     // Minimum confidence score (0-1)
  includeAntiPatterns?: boolean  // Also detect anti-patterns
}
```
**Purpose**: Identify architectural patterns and potential issues

### 4. Path Finding Tools

#### `find_connection`
```typescript
{
  fromId: string,             // Starting vertex
  toId: string,               // Target vertex
  maxDepth?: number,          // Maximum path length (default: 6)
  edgeTypes?: string[],       // Allowed edge types
  shortestOnly?: boolean      // Return only shortest path
}
```
**Purpose**: Find how two pieces of knowledge are connected

#### `trace_execution_path`
```typescript
{
  entryPoint: string,         // Starting function name or ID
  endpoint?: string,          // Optional target function
  includeAsync?: boolean,     // Include async calls
  maxDepth?: number           // Default: 10
}
```
**Purpose**: Trace code execution flow

### 5. Knowledge Management Tools (CRUD)

#### `add_knowledge`
```typescript
{
  type: string,               // Vertex type (Function, Model, Pattern, etc.)
  name: string,               // Unique name within context
  description: string,        // Human-readable description
  project: string,            // Project association
  domain: string,             // Domain classification
  metadata: {                 // Type-specific metadata
    // For Function:
    filePath?: string,
    signature?: string,
    parameters?: string[],
    returnType?: string,
    // For Model:
    properties?: string[],
    methods?: string[],
    // For Pattern:
    problem?: string,
    solution?: string,
    // ... etc
  },
  relationships?: Array<{     // Initial relationships to create
    to: string,               // Target vertex ID or name
    type: string,             // Edge type
    metadata?: object         // Edge metadata
  }>
}
```
**Purpose**: Create new vertices in the knowledge graph

#### `update_knowledge`
```typescript
{
  id: string,                 // Vertex to update
  updates: object,            // Fields to update
  reason?: string,            // Audit trail comment
  updateRelationships?: boolean  // Also update connected vertices
}
```
**Purpose**: Modify existing knowledge

#### `delete_knowledge`
```typescript
{
  id: string,                 // Vertex to delete
  cascade?: boolean,          // Delete orphaned relationships
  safetyCheck?: boolean       // Verify no critical dependencies
}
```
**Purpose**: Remove vertices from the graph

#### `link_vertices`
```typescript
{
  from: string,               // Source vertex ID or name
  to: string,                 // Target vertex ID or name
  edgeType: string,           // Type of relationship
  metadata?: {                // Edge-specific data
    role?: string,
    responsibilities?: string[],
    // ... etc
  }
}
```
**Purpose**: Create relationships between existing vertices

### 6. Bulk Operations Tools

#### `bulk_import`
```typescript
{
  vertices: Array<{           // Array of vertices to create
    type: string,
    name: string,
    // ... other fields
  }>,
  relationships?: Array<{     // Relationships to create after vertices
    from: string,
    to: string,
    type: string
  }>,
  skipExisting?: boolean      // Don't error on duplicates
}
```
**Purpose**: Import multiple vertices at once

#### `bulk_update`
```typescript
{
  filter: {                   // Query to find vertices
    type?: string,
    domain?: string,
    project?: string,
    tags?: string[]
  },
  updates: object,            // Changes to apply
  dryRun?: boolean           // Preview changes without applying
}
```
**Purpose**: Update multiple vertices matching criteria

### 7. Project & Domain Management

#### `list_projects`
```typescript
{
  includeStats?: boolean      // Include vertex counts
}
```

#### `list_domains`
```typescript
{
  project?: string,           // Filter by project
  includeHierarchy?: boolean  // Show domain relationships
}
```

#### `get_project_overview`
```typescript
{
  project: string,            // Project name
  includeDomains?: boolean,   // List all domains
  includeStats?: boolean,     // Vertex/edge counts
  includeRecentChanges?: boolean  // Latest modifications
}
```

## Implementation Architecture

### Directory Structure
```
mcp-server/
├── package.json              # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── README.md                # Setup and usage instructions
├── index.ts                 # Main server entry point
├── config.ts                # Configuration management
│
├── tools/                   # Tool implementations
│   ├── search.ts           # Search & discovery tools
│   ├── details.ts          # Detail retrieval tools
│   ├── analysis.ts         # Analysis tools (dependencies, impact, patterns)
│   ├── pathfinding.ts      # Path & connection finding
│   ├── management.ts       # CRUD operations
│   ├── bulk.ts            # Bulk operations
│   └── project.ts         # Project/domain management
│
├── utils/
│   ├── api-client.ts      # HTTP client wrapper for API calls
│   ├── auth.ts            # Authentication handling
│   ├── cache.ts           # LRU cache implementation
│   ├── formatter.ts       # Result formatting for Claude
│   ├── validator.ts       # Input validation with Zod
│   └── error-handler.ts   # Consistent error handling
│
├── types/
│   ├── tools.ts           # Tool input/output types
│   ├── api.ts             # API response types
│   └── cache.ts           # Cache-related types
│
└── tests/
    ├── tools/              # Tool-specific tests
    └── integration/        # Integration tests
```

### Key Implementation Components

#### API Client
```typescript
class KnowledgeAPIClient {
  constructor(config: {
    baseUrl: string;
    username: string;
    password: string;
  })
  
  // Session management
  async authenticate(): Promise<void>
  async refreshSession(): Promise<void>
  
  // Request wrapper with retry logic
  async request<T>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<T>
  
  // Specialized methods for each endpoint
  async searchKnowledge(params: SearchParams): Promise<SearchResult>
  async getVertex(id: string): Promise<Vertex>
  async createVertex(data: CreateVertexData): Promise<Vertex>
  // ... etc
}
```

#### Cache Manager
```typescript
class CacheManager {
  private cache: LRUCache<string, CachedItem>
  
  constructor(options: {
    maxSize: number;
    defaultTTL: number;
  })
  
  get(key: string): any | null
  set(key: string, value: any, ttl?: number): void
  invalidate(pattern?: string): void
  
  // Invalidation strategies
  invalidateByType(type: string): void
  invalidateByProject(project: string): void
  invalidateAll(): void
}
```

#### Response Formatter
```typescript
class ResponseFormatter {
  // Format for optimal Claude consumption
  formatSearchResults(results: any[]): string
  formatVertex(vertex: Vertex): string
  formatDependencyTree(tree: DependencyTree): string
  formatImpactAnalysis(impact: ImpactResult): string
  
  // Truncation strategies
  truncateLargeResults(results: any[], limit: number): any[]
  summarizeResults(results: any[]): string
  
  // Context enhancement
  addBreadcrumbs(result: any): any
  addRelatedLinks(result: any): any
}
```

## Configuration

### Environment Variables
```bash
# Required
KNOWLEDGE_API_URL=https://knowledge-server-dev.tabus10.com/api
KNOWLEDGE_USERNAME=austin@tabus10.com
KNOWLEDGE_PASSWORD=<password>

# Optional
CACHE_TTL=300                # Cache TTL in seconds (default: 300)
CACHE_MAX_SIZE=100           # Max cache entries (default: 100)
MAX_RESULTS=50               # Max results per query (default: 50)
REQUEST_TIMEOUT=30000        # API timeout in ms (default: 30000)
RETRY_ATTEMPTS=3             # Retry failed requests (default: 3)
LOG_LEVEL=info              # Logging level (default: info)
```

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "knowledge-server": {
      "command": "node",
      "args": ["/path/to/KnowledgeServer/mcp-server/dist/index.js"],
      "env": {
        "KNOWLEDGE_API_URL": "https://knowledge-server-dev.tabus10.com/api",
        "KNOWLEDGE_USERNAME": "austin@tabus10.com",
        "KNOWLEDGE_PASSWORD": "your-password"
      }
    }
  }
}
```

## Usage Examples

### During Development Session
```
Claude: "What functions does the UserService depend on?"
→ Uses: analyze_dependencies with direction='forward'

Claude: "Create a new function entry for the validateEmail helper"
→ Uses: add_knowledge with type='Function'

Claude: "What would break if I delete the legacy auth module?"
→ Uses: analyze_impact with changeType='delete'

Claude: "Find all React components in the project"
→ Uses: list_by_type with type='Component'

Claude: "How is the PaymentService connected to the NotificationService?"
→ Uses: find_connection between the two services
```

### Knowledge Maintenance
```
Claude: "Update all functions in the auth domain to mark them as deprecated"
→ Uses: bulk_update with filter and status='deprecated'

Claude: "Import the function signatures from the new module"
→ Uses: bulk_import with array of functions

Claude: "Clean up orphaned vertices with no relationships"
→ Uses: search_knowledge with custom filters, then delete_knowledge
```

## Testing Strategy

### Local Testing
```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Run inspector
mcp-inspector mcp-server/

# Test individual tools
npm run test:tool search_knowledge -- --query "test"
```

### Integration Testing
- Test each tool against live API
- Verify cache behavior
- Test error scenarios
- Validate response formatting

### Performance Testing
- Measure response times
- Test with large result sets
- Verify cache hit rates
- Monitor memory usage

## Implementation Timeline

### Phase 1: Core Setup (Day 1)
- [ ] Project structure setup
- [ ] TypeScript configuration
- [ ] API client implementation
- [ ] Authentication handling
- [ ] Basic error handling

### Phase 2: Search & Retrieval Tools (Day 1-2)
- [ ] search_knowledge tool
- [ ] find_by_name tool
- [ ] get_details tool
- [ ] get_code_context tool
- [ ] list_by_type tool

### Phase 3: Analysis Tools (Day 2)
- [ ] analyze_dependencies tool
- [ ] analyze_impact tool
- [ ] detect_patterns tool
- [ ] find_connection tool
- [ ] trace_execution_path tool

### Phase 4: Management Tools (Day 3)
- [ ] add_knowledge tool
- [ ] update_knowledge tool
- [ ] delete_knowledge tool
- [ ] link_vertices tool
- [ ] Bulk operations tools

### Phase 5: Testing & Integration (Day 3-4)
- [ ] Unit tests for all tools
- [ ] Integration tests with API
- [ ] Claude Desktop integration
- [ ] Documentation
- [ ] Performance optimization

## Success Metrics

### Functional Requirements
- [ ] All tools working with live API
- [ ] Full CRUD operations supported
- [ ] Cache invalidation working correctly
- [ ] Error handling provides useful feedback

### Performance Requirements
- [ ] Search queries < 500ms
- [ ] Detail retrieval < 300ms
- [ ] Cache hit rate > 60%
- [ ] Memory usage < 256MB

### User Experience
- [ ] Natural language queries work intuitively
- [ ] Results formatted clearly for Claude
- [ ] Errors provide actionable suggestions
- [ ] Context preserved across related queries

## Future Enhancements

### Version 2.0
- Multiple user authentication support
- Team-based permissions
- Webhook support for real-time updates
- Advanced natural language query parsing
- Query optimization suggestions
- Automatic relationship inference
- Change tracking and rollback

### Integration Ideas
- VS Code extension integration
- GitHub Actions integration
- Slack notifications for changes
- Automated documentation generation
- Code review assistance
- Architecture diagram generation

## Notes

### Security Considerations
- API credentials stored securely
- Session timeout handling
- Rate limiting awareness
- Audit trail for modifications

### Performance Optimizations
- Batch API requests where possible
- Implement request deduplication
- Progressive result loading
- Smart cache warming
- Connection pooling

### Error Recovery
- Automatic retry with backoff
- Session refresh on 401
- Graceful degradation
- Helpful error messages
- Fallback to cached data when possible