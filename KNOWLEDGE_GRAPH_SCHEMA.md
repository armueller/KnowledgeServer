# Knowledge Graph Schema Design

## Executive Summary

Knowledge Server uses a comprehensive graph-based schema to capture not just code structure, but the complete context around software systems including the WHY behind decisions, business context, operational knowledge, and team wisdom. This schema enables Claude and developers to understand codebases deeply without constant file reading and context explanation.

## Core Design Philosophy

### "Capture the WHY, not just the WHAT"

Our graph preserves five critical dimensions:
1. **Intent** - Why does this code/architecture exist?
2. **Context** - What situation or problem led to this solution?
3. **Trade-offs** - What alternatives were considered and what did we sacrifice?
4. **Evolution** - How did we get here and where are we going?
5. **Relationships** - How do changes cascade through the system?

## Problem Statement

Traditional code documentation and analysis tools fail to capture:
- **Tribal Knowledge**: Unwritten rules, conventions, and lessons learned
- **Decision Rationale**: Why architectural choices were made
- **Business Context**: How code serves actual business needs
- **Operational Reality**: What happens in production vs theory
- **Historical Context**: Evolution of the codebase and past failures
- **Cross-Cutting Concerns**: Security, performance, compliance implications

## Graph Schema Components

### 📊 Vertex Types (Knowledge Nodes)

#### 1. Code Artifacts
Represent actual code elements with rich semantic information.

| Vertex Type | Purpose | Key Properties |
|-------------|---------|----------------|
| **Function** | Executable code units | `signature`, `parameters`, `returnType`, `sideEffects`, `complexity`, `isAsync`, `isPure` |
| **Model** | Data structures & contracts | `type` (class/interface/enum), `properties`, `methods`, `extends`, `implements` |
| **Component** | UI/Service modules | `type` (UI/service/utility), `exports`, `dependencies`, `lifecycle` |
| **Endpoint** | API/Route definitions | `method`, `path`, `requestSchema`, `responseSchema`, `authentication`, `rateLimit` |
| **Configuration** | Settings & env vars | `environment`, `defaultValue`, `validation`, `sensitive`, `dynamic` |

#### 2. Architectural Elements
Capture system structure and boundaries.

| Vertex Type | Purpose | Key Properties |
|-------------|---------|----------------|
| **Layer** | Architectural layers | `type` (presentation/business/data), `responsibilities`, `boundaries`, `dependencies` |
| **Service** | Micro/macro services | `type`, `protocol`, `sla`, `scaling`, `deployment` |
| **System** | Bounded contexts | `domain`, `boundaries`, `interfaces`, `contracts` |
| **Integration** | External connections | `type` (API/queue/event), `protocol`, `format`, `retry`, `fallback` |
| **Database** | Data storage | `type`, `schema`, `indexes`, `partitioning`, `replication` |

#### 3. Knowledge & Decisions
Preserve the reasoning and wisdom behind the code.

| Vertex Type | Purpose | Key Properties |
|-------------|---------|----------------|
| **Decision** | Architecture Decision Records | `context`, `decision`, `consequences`, `alternatives`, `status`, `date` |
| **Pattern** | Reusable solutions | `type` (design/architectural), `problem`, `solution`, `examples`, `antiPatterns` |
| **Constraint** | Limitations & requirements | `type` (technical/business/regulatory), `impact`, `workarounds`, `validation` |
| **Problem** | Issues being solved | `description`, `impact`, `solutions`, `alternatives`, `tradeoffs` |
| **Concept** | Domain & technical concepts | `type`, `definition`, `examples`, `relationships`, `synonyms` |

#### 4. Operational Intelligence
Capture production reality and operational knowledge.

| Vertex Type | Purpose | Key Properties |
|-------------|---------|----------------|
| **Incident** | Production issues | `severity`, `rootCause`, `impact`, `resolution`, `prevention`, `timeline` |
| **Performance** | Optimization data | `metric`, `baseline`, `target`, `bottleneck`, `optimization`, `benchmark` |
| **Security** | Security concerns | `type`, `severity`, `mitigation`, `compliance`, `auditLog`, `lastReview` |
| **Deployment** | Deployment configs | `environment`, `strategy`, `rollback`, `healthChecks`, `dependencies` |
| **Monitoring** | Observability | `metrics`, `alerts`, `dashboards`, `slos`, `runbooks` |

#### 5. Business Context
Connect code to business value and requirements.

| Vertex Type | Purpose | Key Properties |
|-------------|---------|----------------|
| **Feature** | User-facing functionality | `requirements`, `acceptanceCriteria`, `userStory`, `priority`, `release` |
| **UseCase** | User journeys | `actors`, `flow`, `preconditions`, `postconditions`, `exceptions` |
| **BusinessRule** | Domain logic | `rule`, `validation`, `calculation`, `exceptions`, `authority` |
| **Stakeholder** | People & roles | `role`, `responsibilities`, `concerns`, `contactInfo`, `decisions` |
| **Metric** | Business KPIs | `formula`, `target`, `current`, `trend`, `impact`, `owner` |

#### 6. Development Context
Capture team practices and workflows.

| Vertex Type | Purpose | Key Properties |
|-------------|---------|----------------|
| **Convention** | Team standards | `type` (naming/formatting), `rule`, `examples`, `exceptions`, `rationale` |
| **Workflow** | Dev processes | `steps`, `tools`, `triggers`, `approvals`, `automation` |
| **Tool** | Libraries & frameworks | `version`, `license`, `purpose`, `alternatives`, `migration` |
| **Documentation** | Guides & references | `type`, `audience`, `format`, `location`, `maintainer` |
| **TestStrategy** | Testing approach | `type`, `coverage`, `tools`, `data`, `environments` |

### 🔗 Edge Types (Relationships)

#### Technical Relationships
How code elements interact.

| Edge Type | Direction | Properties | Example |
|-----------|-----------|------------|---------|
| **CALLS** | Function → Function | `callType` (sync/async), `frequency`, `conditional` | `login() CALLS validatePassword()` |
| **IMPLEMENTS** | Component → Pattern | `conformance`, `variations` | `AuthService IMPLEMENTS Singleton` |
| **DEPENDS_ON** | Component → Component | `type` (compile/runtime), `strength` | `UserAPI DEPENDS_ON Database` |
| **MODIFIES** | Function → Model | `operation` (CRUD), `fields`, `validation` | `updateUser() MODIFIES User` |
| **VALIDATES** | Function → BusinessRule | `rules`, `errorHandling` | `processOrder() VALIDATES CreditLimit` |
| **TRANSFORMS** | Function → Model | `from`, `to`, `mapping` | `mapDTO() TRANSFORMS UserDTO to User` |

#### Architectural Relationships
System structure and organization.

| Edge Type | Direction | Properties | Example |
|-----------|-----------|------------|---------|
| **BELONGS_TO** | Component → Layer | `role`, `responsibilities` | `UserController BELONGS_TO Presentation` |
| **COMMUNICATES_WITH** | Service → Service | `protocol`, `format`, `async` | `OrderService COMMUNICATES_WITH PaymentService` |
| **DEPLOYED_IN** | Service → Environment | `version`, `config`, `replicas` | `API DEPLOYED_IN Production` |
| **SCALED_BY** | Service → Strategy | `trigger`, `min`, `max`, `policy` | `WebApp SCALED_BY CPUUtilization` |
| **BACKED_BY** | Service → Database | `operations`, `consistency` | `UserService BACKED_BY PostgreSQL` |

#### Knowledge Relationships
Connect wisdom and decisions.

| Edge Type | Direction | Properties | Example |
|-----------|-----------|------------|---------|
| **SOLVES** | Solution → Problem | `effectiveness`, `tradeoffs` | `CacheLayer SOLVES HighLatency` |
| **CONSTRAINED_BY** | Component → Constraint | `impact`, `workaround` | `PaymentAPI CONSTRAINED_BY PCICompliance` |
| **SUPERSEDES** | Decision → Decision | `reason`, `migration` | `GraphQL SUPERSEDES REST` |
| **ALTERNATIVE_TO** | Solution → Solution | `comparison`, `tradeoffs` | `Redis ALTERNATIVE_TO Memcached` |
| **DERIVED_FROM** | Pattern → Pattern | `modifications`, `rationale` | `CustomAuth DERIVED_FROM OAuth2` |
| **DOCUMENTED_IN** | Any → Documentation | `section`, `version` | `API DOCUMENTED_IN Swagger` |

#### Business Relationships
Connect code to business value.

| Edge Type | Direction | Properties | Example |
|-----------|-----------|------------|---------|
| **SERVES** | Component → UseCase | `functionality`, `priority` | `CheckoutAPI SERVES PurchaseFlow` |
| **MEASURES** | Metric → Feature | `formula`, `frequency` | `ConversionRate MEASURES Checkout` |
| **AUTHORIZED_BY** | Function → Role | `permissions`, `conditions` | `deleteUser() AUTHORIZED_BY Admin` |
| **TRIGGERS** | Event → Workflow | `conditions`, `async` | `OrderPlaced TRIGGERS Fulfillment` |
| **COSTS** | Component → Resource | `unit`, `usage`, `optimization` | `MLModel COSTS GPU-Hours` |

### 🏷️ Universal Properties

Every vertex includes these standard properties:

```typescript
{
  // Identity
  id: string                    // Unique identifier
  name: string                  // Human-readable name
  type: string                  // Specific vertex type
  
  // Multi-Tenancy & Security (CRITICAL)
  tenantId: string              // Organization/company identifier
  userId: string                // Creating user identifier  
  teamId?: string               // Team identifier (for team collaboration)
  visibility: enum              // private|team|organization
  accessLevel: enum             // read|write|admin
  sharedWith?: string[]         // Explicit user/team shares
  
  // Context
  project: string               // Project/repository name
  domain: string                // Business domain
  layer?: string                // Architectural layer
  team?: string                 // Owning team (descriptive)
  
  // Metadata
  createdAt: timestamp          // When created
  updatedAt: timestamp          // Last modified
  createdBy: string             // Author
  updatedBy: string             // Last modifier
  version: string               // Version/commit
  
  // Discovery
  tags: string[]                // Searchable tags
  keywords: string[]            // Search terms
  description: string           // Human description
  summary?: string              // Brief overview
  
  // Quality
  status: enum                  // active|deprecated|experimental|archived
  confidence: number            // 0.0-1.0 reliability score
  complexity?: number           // Cyclomatic/cognitive complexity
  quality?: number              // Quality score
  
  // Business
  businessValue?: string        // Business justification
  priority?: enum               // critical|high|medium|low
  owner?: string                // Business owner
  costCenter?: string           // Financial attribution
}
```

### 🔐 Multi-Tenant Security Model

#### Access Control Hierarchy
```
Organization (tenantId)
├── Teams (teamId)
│   ├── Members (userId with team access)
│   └── Projects (shared team knowledge)
└── Individual Users (userId, private knowledge)
```

#### Visibility Levels
- **`private`**: Only the creating user can access
- **`team`**: All team members can access (requires teamId)
- **`organization`**: All users in organization can access
- **`shared`**: Explicitly shared with specific users/teams (sharedWith array)

#### Access Patterns
- **Read Access**: User can view and query the knowledge
- **Write Access**: User can modify and update the knowledge  
- **Admin Access**: User can delete and manage sharing permissions

#### Security Query Filters
All queries automatically include security filters:

```gremlin
// Automatic security filter applied to every query
g.V()
 .or(
   has('userId', currentUserId).has('visibility', 'private'),
   has('teamId', within(userTeamIds)).has('visibility', 'team'),
   has('tenantId', currentTenantId).has('visibility', 'organization'),
   has('sharedWith', containing(currentUserId))
 )
 .has('tenantId', currentTenantId) // Always enforce tenant isolation
```

## Query Patterns Enabled

### Code Understanding Queries
```gremlin
// "What does this function do and why does it exist?"
g.V().has('Function', 'name', 'processPayment')
  .project('function', 'problem', 'pattern', 'rules')
  .by(valueMap())
  .by(out('SOLVES').valueMap())
  .by(out('IMPLEMENTS').valueMap())
  .by(out('VALIDATES').valueMap())

// "What breaks if I change this model?"
g.V().has('Model', 'name', 'User')
  .in('MODIFIES', 'TRANSFORMS', 'VALIDATES')
  .dedup()
  .values('name')

// "Show me similar authentication implementations"
g.V().has('Pattern', 'name', 'Authentication')
  .in('IMPLEMENTS')
  .has('status', 'active')
  .limit(10)
```

### Architecture Insight Queries
```gremlin
// "What are the system boundaries?"
g.V().hasLabel('System')
  .project('system', 'interfaces', 'dependencies')
  .by(valueMap())
  .by(out('EXPOSES').count())
  .by(out('DEPENDS_ON').count())

// "How do services communicate?"
g.V().hasLabel('Service')
  .outE('COMMUNICATES_WITH')
  .project('from', 'to', 'protocol', 'format')
  .by(outV().values('name'))
  .by(inV().values('name'))
  .by('protocol')
  .by('format')

// "What are the performance bottlenecks?"
g.V().hasLabel('Performance')
  .has('bottleneck', true)
  .project('component', 'metric', 'impact')
  .by(in('MEASURES').values('name'))
  .by('metric')
  .by('impact')
```

### Business Context Queries
```gremlin
// "What business rule does this implement?"
g.V().has('Function', 'name', 'calculateDiscount')
  .out('VALIDATES', 'IMPLEMENTS')
  .hasLabel('BusinessRule')
  .valueMap()

// "Who are the stakeholders for this feature?"
g.V().has('Feature', 'name', 'QuickCheckout')
  .out('OWNED_BY', 'REQUESTED_BY')
  .hasLabel('Stakeholder')
  .values('name', 'role')

// "What's the business impact of changing this?"
g.V().has('Component', 'name', 'PricingEngine')
  .out('SERVES')
  .hasLabel('UseCase', 'Feature')
  .out('MEASURES')
  .hasLabel('Metric')
  .values('name', 'impact')
```

### Historical Context Queries
```gremlin
// "Why did we choose this approach?"
g.V().has('Component', 'name', 'MessageQueue')
  .in('SOLVES')
  .hasLabel('Problem', 'Decision')
  .project('problem', 'alternatives', 'rationale')
  .by('description')
  .by(out('ALTERNATIVE_TO').values('name'))
  .by('rationale')

// "How has this evolved?"
g.V().has('Decision', 'area', 'Authentication')
  .repeat(out('SUPERSEDES')).emit()
  .order().by('date', desc)
  .valueMap('decision', 'date', 'status')

// "What incidents involved this component?"
g.V().has('Component', 'name', 'PaymentGateway')
  .in('INVOLVED_IN')
  .hasLabel('Incident')
  .order().by('severity', desc)
  .limit(10)
```

## Implementation Priorities

### Phase 1: Core Code Intelligence
1. Function, Model, Component vertices
2. CALLS, IMPLEMENTS, DEPENDS_ON edges
3. Basic search and traversal

### Phase 2: Architectural Context
1. Pattern, Decision, Problem vertices
2. Service, System, Layer vertices
3. SOLVES, BELONGS_TO relationships

### Phase 3: Business Alignment
1. Feature, UseCase, BusinessRule vertices
2. Stakeholder, Metric vertices
3. SERVES, MEASURES relationships

### Phase 4: Operational Intelligence
1. Incident, Performance, Security vertices
2. Deployment, Monitoring vertices
3. Historical tracking and evolution

### Phase 5: Advanced Discovery
1. Similarity scoring algorithms
2. Pattern recommendation engine
3. Impact analysis and prediction
4. Knowledge gap detection

## Success Metrics

### Technical Metrics
- Query response time < 100ms for 3-hop traversals
- Support for 1M+ vertices with linear scaling
- 99.9% availability for read operations
- Real-time updates (< 1s propagation)

### Business Metrics
- 80% reduction in context setup time for Claude
- 60% faster onboarding for new developers
- 50% reduction in repeated problems
- 90% of architectural decisions documented

### User Experience Metrics
- Claude can answer "why" questions without file reading
- Developers find relevant examples in < 30 seconds
- Architecture reviews completed 3x faster
- Knowledge gaps identified proactively

## Migration Strategy

### From Existing Codebases
1. **Static Analysis**: Parse code to extract functions, models, dependencies
2. **Git Mining**: Extract evolution, authors, change patterns
3. **Documentation parsing**: Extract decisions, patterns from existing docs
4. **Tool Integration**: Import from Jira, Confluence, ADR tools
5. **Incremental Enhancement**: Add business context and operational data over time

### Data Sources
- **Code**: AST parsing, dependency analysis, complexity metrics
- **Version Control**: Git history, blame, commit messages
- **Documentation**: Markdown files, comments, ADRs
- **Runtime**: APM data, logs, metrics, traces
- **Business**: Requirements, user stories, KPIs

## Future Enhancements

### Machine Learning Integration
- Automatic pattern detection
- Similarity scoring using embeddings
- Anomaly detection in architecture
- Predictive impact analysis

### Advanced Features
- Time-travel queries (see system at any point in time)
- What-if analysis for proposed changes
- Automatic documentation generation
- Knowledge completeness scoring
- Cross-project knowledge federation

## Conclusion

This knowledge graph schema transforms scattered information into a queryable, connected knowledge network that preserves not just code structure but the complete context needed for intelligent decision-making. By capturing the WHY behind code, architectural decisions, and business alignment, we enable Claude and developers to truly understand systems without constant context rebuilding.

The schema is designed to be:
- **Flexible**: Adapt to any codebase or architecture style
- **Comprehensive**: Capture technical, business, and operational knowledge
- **Discoverable**: Enable powerful queries and relationships
- **Evolutionary**: Grow and adapt as the system evolves
- **Practical**: Start simple and enhance incrementally

This foundation enables Knowledge Server to be the persistent memory layer that makes AI-assisted development truly intelligent and context-aware.