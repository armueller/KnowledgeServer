# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KnowledgeServer is a Neo4j-based knowledge management system built with React Router v7, TypeScript, and AWS services. The application provides contextual knowledge management across multiple projects with MCP (Model Context Protocol) integration for seamless Claude interaction.

## ⚠️ CRITICAL: MANDATORY DEVELOPMENT PROCEDURES ⚠️

**YOU MUST FOLLOW THESE PROCEDURES FOR EVERY SESSION, EVERY TASK, NO EXCEPTIONS:**

These procedures exist to maintain code quality, provide context between sessions, and ensure sustainable development. **FAILURE TO FOLLOW THESE PROCEDURES VIOLATES THE PROJECT'S DEVELOPMENT STANDARDS.**

**📊 REFERENCE: See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for comprehensive project architecture, technology decisions, and detailed implementation phases.**

### 🚨 SAFETY RULE: READ BEFORE MODIFY 🚨

**NEVER MODIFY BUSINESS LOGIC OR DATA STORAGE WITHOUT READING AND UNDERSTANDING THE EXISTING IMPLEMENTATION FIRST**

**Examples of DANGEROUS Changes That Must Be Avoided:**
❌ **NEVER change Neo4j schema** without understanding existing node relationships
❌ **NEVER modify API contracts** without checking all consumers
❌ **NEVER assume data structures** - always read the actual Neo4j model first
❌ **NEVER write tests based on assumptions** - tests must reflect actual behavior

**Safe Approach:** ✅ Read implementation thoroughly ✅ Understand graph relationships ✅ Make minimal changes ✅ Verify compatibility ✅ Test actual behavior

### MANDATORY WORKFLOW - Execute Per Task

**CRITICAL**: Execute these steps **PER TASK**, not at project end. This ensures documentation remains fresh while context is available.

#### 1. Research Before Implementation
- **MANDATORY**: Check IMPLEMENTATION_PLAN.md for architectural decisions
- Research relevant Neo4j patterns and existing code
- Understand graph relationships and data flow
- Identify dependencies and existing patterns

#### 2. Plan and Branch
- Discuss implementation details with user BEFORE coding
- Create feature branch: `git checkout -b feature/descriptive-name`
- Document plan in `changePlan.md` (gitignored)

#### 3. Implement Changes
- Follow Neo4j and React Router v7 best practices from IMPLEMENTATION_PLAN.md
- Ensure changes follow established patterns
- Maintain type safety throughout

#### 4. Validate Per Task (MANDATORY)
```bash
npm run typecheck  # Fix TypeScript errors
npm run lint       # Fix linting errors (0 warnings policy) 
npm test           # Write/update tests, ensure all pass
```

#### 5. Document Per Task (MANDATORY)
- Update relevant documentation immediately after each task
- Update IMPLEMENTATION_PLAN.md if architectural decisions change
- Document Neo4j schema changes and migration scripts
- **RECENCY BIAS PREVENTION**: Preserve existing context while adding new information

#### 6. Commit and Continue
- Commit changes with detailed messages based on work completed
- Continue with next task or proceed to project completion if all tasks done

#### 7. Project Completion (When All Tasks Complete)
- **Verify All Changes Committed**: Ensure all work is committed to the feature branch
- **Push Branch**: `git push origin feature/branch-name`
- **Create Pull Request** with comprehensive description

## Project Architecture

### Core Technologies
- **Frontend**: React Router v7 with SSR, TypeScript, TailwindCSS
- **Database**: Neo4j with JavaScript Driver v5.2+
- **API**: REST endpoints + GraphQL (Apollo Server)
- **MCP Integration**: TypeScript SDK for Claude interaction
- **Infrastructure**: AWS CDK, ECS Fargate, Neo4j AuraDB
- **Build Tools**: Vite, ESLint flat config, Prettier

### Key Architectural Patterns

#### Neo4j Graph Model
```cypher
// Core node types with relationships
(:Function)-[:CALLS]->(:Function)
(:Function)-[:USES]->(:Model)
(:Function)-[:BELONGS_TO]->(:Project)
(:Model)-[:EXTENDS]->(:Model)
(:Pattern)-[:APPLIES_TO]->(:Project)
```

#### React Router v7 Structure
- File-based routing with `flatRoutes()`
- SSR enabled by default
- Type generation in `.react-router/types/`
- API routes co-located with pages

#### MCP Server Integration
- Tools for knowledge search and retrieval
- Claude integration for contextual queries
- Real-time knowledge base interaction

## Development Commands

```bash
# Development
npm run dev              # Local development
npm run dev:prod         # Development with production config

# Build & Quality
npm run build            # Production build
npm run typecheck        # Generate types and run TypeScript compiler
npm run type-check       # TypeScript compilation check only
npm run lint             # ESLint validation (max 0 warnings)

# Testing
npm test                 # Run test suite
npm run test:ui          # Test UI
npm run test:coverage    # Coverage reports

# Database & Migration
npm run migrate:rmwm     # Migrate RMWM context data to Neo4j
npm run seed:database    # Seed initial data

# MCP Server
npm run mcp:server       # Start MCP server for Claude integration

# Deployment
npm run deploy:staging   # Deploy to AWS staging
npm run deploy:prod      # Deploy to AWS production
```

## Environment Setup

- Uses modern Node.js 20+ with TypeScript ESM modules
- Local development runs on port 5173 (Vite default)
- Environment-specific configuration via `.env.staging` and `.env.production`
- Neo4j connection via environment variables

## Code Style and Patterns

### TypeScript Standards
- **Strict Mode**: Always enabled with comprehensive type checking
- **Type Safety**: Use Neo4j driver generics for Node/Relationship types
- **Interfaces**: Define clear interfaces for all data structures
- **Validation**: Use Zod for runtime type validation

### Neo4j Patterns
- **Repository Pattern**: Encapsulate database operations
- **Type-Safe Queries**: Use TypeScript generics for query results
- **Connection Management**: Proper session and driver cleanup
- **Performance**: Implement indexes and query optimization

### React Router v7 Patterns
- **File-Based Routing**: Use `flatRoutes()` for automatic route generation
- **Server-Side Rendering**: Leverage SSR for better performance
- **Type Generation**: Use generated types for route modules
- **API Co-location**: Keep API routes near their page components

## Critical Development Rules

### Neo4j Safety Rules
1. **Always use transactions** for multi-operation changes
2. **Create indexes** for frequently queried properties
3. **Validate relationships** before creating connections
4. **Handle driver cleanup** properly to prevent connection leaks
5. **Use parameterized queries** to prevent injection attacks

### Testing Requirements
- **Unit Tests**: All repository and service functions
- **Integration Tests**: API endpoints and Neo4j operations
- **Graph Tests**: Verify relationship integrity and traversals
- **MCP Tests**: Validate tool functionality with mock data

### Performance Guidelines
- **Query Optimization**: Use EXPLAIN/PROFILE for slow queries
- **Batch Operations**: Group database operations when possible
- **Connection Pooling**: Configure appropriate pool sizes
- **Caching**: Implement appropriate caching strategies

## File Structure Reference

```
KnowledgeServer/
├── app/                    # React Router v7 application
│   ├── routes/            # File-based routes
│   ├── models/            # TypeScript interfaces
│   ├── services/          # Business logic
│   └── components/        # React components
├── mcp-server/            # MCP server implementation
├── infrastructure/        # AWS CDK code
├── scripts/              # Migration and utility scripts
└── tests/                # Test files
```

## Migration from RMWM Context Database

The project includes migration scripts to transfer existing SQLite context data to Neo4j:

1. **Function Migration**: Maps SQLite functions table to Neo4j Function nodes
2. **Model Migration**: Transfers TypeScript interfaces to Model nodes
3. **Relationship Building**: Creates graph relationships from foreign keys
4. **Validation**: Ensures data integrity after migration

## MCP Server Tools

The MCP server provides these tools for Claude interaction:

- `search_knowledge`: Cross-project knowledge search
- `get_function_details`: Detailed function information with dependencies
- `trace_dependencies`: Follow dependency chains
- `analyze_architecture`: Architectural insights and recommendations

## Success Metrics

- Claude can successfully query knowledge across all projects
- Graph queries execute in <100ms for typical searches
- System handles 1000+ knowledge nodes with good performance
- API endpoints respond in <200ms for standard operations
- Frontend loads in <2s with interactive visualizations

## Important Notes

- **Database First**: Neo4j schema drives the application architecture  
- **Type Safety**: Maintain strict TypeScript throughout the stack
- **Graph Thinking**: Model relationships as first-class entities
- **Performance**: Design for scale from the beginning
- **Documentation**: Keep IMPLEMENTATION_PLAN.md updated with architectural changes