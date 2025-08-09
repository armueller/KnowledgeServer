#!/usr/bin/env npx tsx
/**
 * Document KnowledgeServer architecture patterns and functions in Neptune
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE_URL = 'https://knowledge-server-dev.tabus10.com/api';
const AUTH_USERNAME = process.env.MIGRATION_USERNAME || '';
const AUTH_PASSWORD = process.env.MIGRATION_PASSWORD || '';

interface DocumentationEntry {
  type: string;
  name: string;
  description: string;
  project: string;
  domain: string;
  visibility: 'private' | 'team' | 'organization' | 'shared';
  [key: string]: any;
}

class ArchitectureDocumenter {
  private sessionCookie: string = '';

  async authenticate(): Promise<void> {
    console.log('🔐 Authenticating with KnowledgeServer...');
    
    if (!AUTH_USERNAME || !AUTH_PASSWORD) {
      throw new Error('Missing authentication credentials. Set MIGRATION_USERNAME and MIGRATION_PASSWORD environment variables.');
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: AUTH_USERNAME,
          password: AUTH_PASSWORD,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Authentication failed: ${error}`);
      }
      
      // Extract session cookie from response
      const setCookieHeader = response.headers.get('set-cookie');
      if (!setCookieHeader) {
        throw new Error('No session cookie received from authentication');
      }
      
      // Store the cookie for future requests
      this.sessionCookie = setCookieHeader;
      console.log('✅ Authentication successful\n');
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  async createEntry(entry: DocumentationEntry): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create ${entry.type} "${entry.name}": ${error}`);
      }

      const result = await response.json();
      console.log(`✅ Created ${entry.type}: ${entry.name}`);
    } catch (error) {
      console.error(`❌ Failed to create ${entry.type} "${entry.name}":`, error);
      throw error;
    }
  }

  async documentPatterns(): Promise<void> {
    console.log('\n📋 Documenting Architectural Patterns...\n');

    const patterns: DocumentationEntry[] = [
      {
        type: 'Pattern',
        name: 'Thin Routes + Handlers Pattern',
        description: 'Architectural pattern for organizing API routes in React Router v7 flat file routing system. Routes act as thin dispatchers that delegate to focused handler functions.',
        project: 'KnowledgeServer',
        domain: 'architecture',
        visibility: 'private',
        patternType: 'architectural',
        problem: 'React Router v7 uses flat file routing where routes cannot be organized in subdirectories, leading to large monolithic route files that violate separation of concerns',
        solution: 'Create thin route files (50-75 lines) that only dispatch requests to handler functions organized in a separate handlers directory. Each handler has single responsibility and receives (request, context) parameters.',
        examples: [
          'api.search.advanced.ts dispatches to handlers/search/{domainSearch,tagSearch,etc}',
          'api.knowledge.ts dispatches to handlers/knowledge/{getKnowledge,createKnowledge,etc}',
          'api.relationships.ts dispatches to handlers/relationships/{getEdgesFrom,createEdge,etc}'
        ],
        antiPatterns: [
          'Re-validating session in handlers when middleware already validated',
          'Putting business logic directly in route files',
          'Creating duplicate utilities instead of sharing',
          'Using default visibility values instead of explicit security'
        ],
        tags: ['api', 'routing', 'architecture', 'react-router', 'handlers'],
        keywords: ['thin routes', 'dispatcher pattern', 'handler pattern', 'flat file routing'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      },
      {
        type: 'Pattern',
        name: 'Authentication Middleware Pattern',
        description: 'Pattern for handling authentication consistently across all API routes using middleware that validates once and passes context to handlers.',
        project: 'KnowledgeServer',
        domain: 'security',
        visibility: 'private',
        patternType: 'architectural',
        problem: 'Redundant authentication checks in every handler leading to performance issues and inconsistent security implementation',
        solution: 'Use middleware (apiLoaderWithUserAuth, apiActionWithUserAuth) that validates session once and passes validated userId in context to handlers',
        examples: [
          'apiLoaderWithUserAuth for GET requests',
          'apiActionWithUserAuth for POST/PUT/DELETE requests',
          'buildSecurityContext(context.userId) in handlers'
        ],
        antiPatterns: [
          'Re-validating session in handlers',
          'Passing full security context through headers',
          'Using fallback authentication values'
        ],
        tags: ['authentication', 'middleware', 'security', 'api'],
        keywords: ['auth middleware', 'session validation', 'security context'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      }
    ];

    for (const pattern of patterns) {
      await this.createEntry(pattern);
    }
  }

  async documentRepositoryPattern(): Promise<void> {
    console.log('\n🗃️ Documenting Repository Pattern...\n');

    const pattern: DocumentationEntry = {
      type: 'Pattern',
      name: 'Neptune Repository Pattern',
      description: 'Data access layer pattern that encapsulates all Neptune/Gremlin database operations with multi-tenant security built-in.',
      project: 'KnowledgeServer',
      domain: 'data-access',
      visibility: 'private',
      patternType: 'architectural',
      problem: 'Direct database access from handlers leads to scattered query logic, inconsistent security implementation, and difficult testing',
      solution: 'Centralized KnowledgeGraphRepository class that handles all database operations with automatic security context application, vertex/edge type safety, and consistent error handling',
      examples: [
        'KnowledgeGraphRepository with vertices and edges sub-repositories',
        'Automatic tenantId and visibility filtering',
        'Type-safe vertex and edge creation with generics'
      ],
      antiPatterns: [
        'Direct Gremlin queries in handlers',
        'Manual security context application in queries',
        'Scattered database connection management'
      ],
      tags: ['repository', 'database', 'neptune', 'gremlin', 'data-access'],
      keywords: ['repository pattern', 'data access layer', 'neptune repository'],
      status: 'active',
      confidence: 1.0,
      version: '1.0.0'
    };

    await this.createEntry(pattern);
  }

  async documentFunctions(): Promise<void> {
    console.log('\n⚙️ Documenting Key Functions...\n');

    const functions: DocumentationEntry[] = [
      {
        type: 'Function',
        name: 'buildSecurityContext',
        description: 'Builds a complete security context from a validated userId. Used by all handlers to create consistent security context without re-validation.',
        project: 'KnowledgeServer',
        domain: 'security',
        visibility: 'private',
        filePath: 'app/handlers/utils/auth.ts',
        signature: 'async function buildSecurityContext(userId: string): Promise<SecurityContext>',
        isAsync: true,
        isPure: false,
        lineStart: 129,
        lineEnd: 139,
        returnType: 'Promise<SecurityContext>',
        parameters: ['userId'],
        sideEffects: ['database-read'],
        tags: ['security', 'authentication', 'context'],
        keywords: ['security context', 'user context', 'auth'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      },
      {
        type: 'Function',
        name: 'parseSearchParams',
        description: 'Parses common search parameters from request URL. Provides consistent parameter extraction across all search handlers.',
        project: 'KnowledgeServer',
        domain: 'utilities',
        visibility: 'private',
        filePath: 'app/handlers/utils/security.ts',
        signature: 'function parseSearchParams(request: Request)',
        isAsync: false,
        isPure: true,
        lineStart: 4,
        lineEnd: 16,
        returnType: 'SearchParams',
        parameters: ['request'],
        sideEffects: [],
        tags: ['parameters', 'parsing', 'search', 'utilities'],
        keywords: ['param extraction', 'search params', 'url params'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      },
      {
        type: 'Function',
        name: 'parseRelationshipParams',
        description: 'Parses relationship/edge parameters from request URL. Used by all relationship handlers for consistent parameter extraction.',
        project: 'KnowledgeServer',
        domain: 'utilities',
        visibility: 'private',
        filePath: 'app/handlers/utils/security.ts',
        signature: 'function parseRelationshipParams(request: Request)',
        isAsync: false,
        isPure: true,
        lineStart: 35,
        lineEnd: 47,
        returnType: 'RelationshipParams',
        parameters: ['request'],
        sideEffects: [],
        tags: ['parameters', 'parsing', 'relationships', 'edges', 'utilities'],
        keywords: ['relationship params', 'edge params', 'param extraction'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      },
      {
        type: 'Function',
        name: 'apiLoaderWithUserAuth',
        description: 'Middleware wrapper for GET requests that validates user session and passes userId in context to handlers.',
        project: 'KnowledgeServer',
        domain: 'middleware',
        visibility: 'private',
        filePath: 'app/middleware/loaderWithUserAuth.ts',
        signature: 'export function apiLoaderWithUserAuth<T extends { userId: string }>(handler: LoaderFunction<T>): LoaderFunction',
        isAsync: false,
        isPure: false,
        lineStart: 1,
        lineEnd: 20,
        returnType: 'LoaderFunction',
        parameters: ['handler'],
        sideEffects: ['session-validation'],
        tags: ['middleware', 'authentication', 'loader', 'GET'],
        keywords: ['auth middleware', 'loader auth', 'GET authentication'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      },
      {
        type: 'Function',
        name: 'apiActionWithUserAuth',
        description: 'Middleware wrapper for POST/PUT/DELETE requests that validates user session and passes userId in context to handlers.',
        project: 'KnowledgeServer',
        domain: 'middleware',
        visibility: 'private',
        filePath: 'app/middleware/actionWithUserAuth.ts',
        signature: 'export function apiActionWithUserAuth<T extends { userId: string }>(handler: ActionFunction<T>): ActionFunction',
        isAsync: false,
        isPure: false,
        lineStart: 1,
        lineEnd: 20,
        returnType: 'ActionFunction',
        parameters: ['handler'],
        sideEffects: ['session-validation'],
        tags: ['middleware', 'authentication', 'action', 'POST', 'PUT', 'DELETE'],
        keywords: ['auth middleware', 'action auth', 'mutation authentication'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      }
    ];

    for (const func of functions) {
      await this.createEntry(func);
    }
  }

  async documentRepositoryMethods(): Promise<void> {
    console.log('\n📦 Documenting Repository Methods...\n');

    const methods: DocumentationEntry[] = [
      {
        type: 'Function',
        name: 'createVertex',
        description: 'Creates a new vertex in Neptune with automatic security context, tenant isolation, and type safety through generics.',
        project: 'KnowledgeServer',
        domain: 'data-access',
        visibility: 'private',
        filePath: 'app/services/neptune/vertices.ts',
        signature: 'async createVertex<T extends KnowledgeVertex>(properties: Omit<T, AutoGeneratedFields>): Promise<T>',
        isAsync: true,
        isPure: false,
        lineStart: 50,
        lineEnd: 120,
        returnType: 'Promise<T>',
        parameters: ['properties'],
        sideEffects: ['database-write'],
        tags: ['repository', 'create', 'vertex', 'neptune'],
        keywords: ['create vertex', 'add node', 'database insert'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      },
      {
        type: 'Function',
        name: 'createEdge',
        description: 'Creates a new edge between two vertices with automatic security validation, ensuring both vertices are accessible to the user.',
        project: 'KnowledgeServer',
        domain: 'data-access',
        visibility: 'private',
        filePath: 'app/services/neptune/edges.ts',
        signature: 'async createEdge<T extends KnowledgeEdge>(fromId: string, toId: string, properties: Omit<T, AutoGeneratedFields>): Promise<T>',
        isAsync: true,
        isPure: false,
        lineStart: 30,
        lineEnd: 100,
        returnType: 'Promise<T>',
        parameters: ['fromId', 'toId', 'properties'],
        sideEffects: ['database-write'],
        tags: ['repository', 'create', 'edge', 'relationship', 'neptune'],
        keywords: ['create edge', 'add relationship', 'connect vertices'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      },
      {
        type: 'Function',
        name: 'findVertexById',
        description: 'Retrieves a vertex by ID with automatic security filtering to ensure user has access permissions.',
        project: 'KnowledgeServer',
        domain: 'data-access',
        visibility: 'private',
        filePath: 'app/services/neptune/vertices.ts',
        signature: 'async findVertexById(id: string): Promise<KnowledgeVertex | null>',
        isAsync: true,
        isPure: false,
        lineStart: 130,
        lineEnd: 160,
        returnType: 'Promise<KnowledgeVertex | null>',
        parameters: ['id'],
        sideEffects: ['database-read'],
        tags: ['repository', 'read', 'vertex', 'neptune', 'query'],
        keywords: ['find vertex', 'get by id', 'retrieve node'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      },
      {
        type: 'Function',
        name: 'traverseGraph',
        description: 'Performs graph traversal from a starting vertex up to specified depth, with optional edge type filtering.',
        project: 'KnowledgeServer',
        domain: 'graph-operations',
        visibility: 'private',
        filePath: 'app/services/neptune/repository.ts',
        signature: 'async traverseGraph(startId: string, depth: number, edgeTypes?: string[]): Promise<TraversalPath[]>',
        isAsync: true,
        isPure: false,
        lineStart: 200,
        lineEnd: 280,
        returnType: 'Promise<TraversalPath[]>',
        parameters: ['startId', 'depth', 'edgeTypes'],
        sideEffects: ['database-read'],
        tags: ['repository', 'traversal', 'graph', 'neptune', 'query'],
        keywords: ['graph traversal', 'traverse', 'explore graph', 'follow edges'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      }
    ];

    for (const method of methods) {
      await this.createEntry(method);
    }
  }

  async run(): Promise<void> {
    try {
      await this.authenticate();
      // await this.documentPatterns();  // Already documented
      await this.documentRepositoryPattern();
      // await this.documentFunctions();  // Already documented
      await this.documentRepositoryMethods();
      
      console.log('\n✨ Documentation complete!\n');
    } catch (error) {
      console.error('\n❌ Documentation failed:', error);
      process.exit(1);
    }
  }
}

// Run the documenter
const documenter = new ArchitectureDocumenter();
documenter.run();