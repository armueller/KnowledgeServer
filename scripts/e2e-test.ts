#!/usr/bin/env npx tsx
/**
 * End-to-End Test Suite for KnowledgeServer API
 * 
 * This script tests all non-admin API endpoints and includes:
 * - Complete test coverage of all operations
 * - Automatic cleanup of test data
 * - Detailed reporting of pass/fail status
 * - Idempotent execution (can run multiple times safely)
 * 
 * Usage:
 *   npm run test:e2e
 *   SKIP_CLEANUP=true npm run test:e2e  # For debugging
 */

import fetch from 'node-fetch';
import { randomBytes } from 'crypto';

// Configuration
const API_BASE_URL = 'https://knowledge-server-dev.tabus10.com/api';
const AUTH_USERNAME = process.env.MIGRATION_USERNAME || '';
const AUTH_PASSWORD = process.env.MIGRATION_PASSWORD || '';
const SKIP_CLEANUP = process.env.SKIP_CLEANUP === 'true';

// Generate unique test prefix to avoid conflicts
const TEST_PREFIX = `E2E_TEST_${Date.now()}_${randomBytes(4).toString('hex')}`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

interface TestReport {
  passed: string[];
  failed: Array<{ test: string; error: string }>;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  startTime: number;
  endTime?: number;
}

interface EdgeReference {
  fromId: string;
  toId: string;
  type: string;
}

class E2ETestRunner {
  private sessionCookie: string = '';
  private createdVertexIds: string[] = [];
  private createdEdges: EdgeReference[] = [];
  private testReport: TestReport;

  constructor() {
    this.testReport = {
      passed: [],
      failed: [],
      totalTests: 0,
      passedCount: 0,
      failedCount: 0,
      startTime: Date.now(),
    };
  }

  /**
   * Main test execution
   */
  async run(): Promise<void> {
    console.log(`\n${colors.cyan}🚀 Starting E2E Tests${colors.reset}`);
    console.log(`${colors.gray}Test Prefix: ${TEST_PREFIX}${colors.reset}\n`);

    try {
      // Setup
      await this.authenticate();

      // Run test suites
      await this.testHealthCheck();
      await this.testAuthentication();
      await this.testKnowledgeAPI();
      await this.testRelationshipsAPI();
      await this.testSearchAPI();

      // Report results
      this.testReport.endTime = Date.now();
      this.printSummary();

    } catch (error) {
      console.error(`${colors.red}❌ Test suite failed:${colors.reset}`, error);
    } finally {
      // Cleanup
      if (!SKIP_CLEANUP) {
        await this.cleanup();
      } else {
        console.log(`${colors.yellow}⚠️  Skipping cleanup (SKIP_CLEANUP=true)${colors.reset}`);
        console.log(`${colors.gray}Created vertices: ${this.createdVertexIds.join(', ')}${colors.reset}`);
      }
    }

    // Exit with appropriate code
    process.exit(this.testReport.failedCount > 0 ? 1 : 0);
  }

  /**
   * Authenticate with the API
   */
  private async authenticate(): Promise<void> {
    console.log(`${colors.blue}🔐 Authenticating...${colors.reset}`);
    
    if (!AUTH_USERNAME || !AUTH_PASSWORD) {
      throw new Error('Missing credentials. Set MIGRATION_USERNAME and MIGRATION_PASSWORD');
    }

    const response = await fetch(`${API_BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: AUTH_USERNAME,
        password: AUTH_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${await response.text()}`);
    }

    const setCookieHeader = response.headers.get('set-cookie');
    if (!setCookieHeader) {
      throw new Error('No session cookie received');
    }

    this.sessionCookie = setCookieHeader;
    console.log(`${colors.green}✅ Authenticated successfully${colors.reset}\n`);
  }

  /**
   * Test health check endpoint
   */
  private async testHealthCheck(): Promise<void> {
    console.log(`${colors.cyan}📋 Testing Health Check${colors.reset}`);

    await this.runTest('Health Check - API Status', async () => {
      const response = await fetch(`${API_BASE_URL}/health/neptune`, {
        method: 'GET',
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data, 'status', 'string');
    });
  }

  /**
   * Test authentication endpoints
   */
  private async testAuthentication(): Promise<void> {
    console.log(`\n${colors.cyan}📋 Testing Authentication${colors.reset}`);

    await this.runTest('Auth - Invalid Credentials', async () => {
      const response = await fetch(`${API_BASE_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'invalid@example.com',
          password: 'wrongpassword',
        }),
      });
      
      this.assertStatus(response, 401);
    });

    await this.runTest('Auth - Access Protected Endpoint Without Auth', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge?op=list`, {
        method: 'GET',
      });
      
      this.assertStatus(response, 401);
    });

    await this.runTest('Auth - Access Protected Endpoint With Auth', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge?op=list`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
    });
  }

  /**
   * Test Knowledge API CRUD operations
   */
  private async testKnowledgeAPI(): Promise<void> {
    console.log(`\n${colors.cyan}📋 Testing Knowledge API${colors.reset}`);

    let functionId: string = '';
    let modelId: string = '';
    let patternId: string = '';

    // Create Function
    await this.runTest('Knowledge - Create Function Vertex', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          type: 'Function',
          name: `${TEST_PREFIX}_testFunction`,
          description: 'Test function for E2E testing',
          project: 'E2E_TEST',
          domain: 'testing',
          visibility: 'private',
          filePath: '/test/functions.ts',
          signature: 'function testFunction(): void',
          isAsync: false,
          isPure: true,
          lineStart: 10,
          lineEnd: 20,
          returnType: 'void',
          parameters: [],
          sideEffects: [],
        }),
      });
      
      this.assertStatus(response, 201);
      const data = await response.json();
      this.assertProperty(data, 'success', 'boolean');
      this.assertProperty(data.data, 'id', 'string');
      
      functionId = data.data.id;
      this.createdVertexIds.push(functionId);
    });

    // Create Model
    await this.runTest('Knowledge - Create Model Vertex', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          type: 'Model',
          name: `${TEST_PREFIX}_TestModel`,
          description: 'Test model for E2E testing',
          project: 'E2E_TEST',
          domain: 'testing',
          visibility: 'private',
          filePath: '/test/models.ts',
          modelType: 'interface',
          properties: ['id: string', 'name: string'],
          methods: [],
          lineStart: 1,
          lineEnd: 5,
        }),
      });
      
      this.assertStatus(response, 201);
      const data = await response.json();
      modelId = data.data.id;
      this.createdVertexIds.push(modelId);
    });

    // Create Pattern
    await this.runTest('Knowledge - Create Pattern Vertex', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          type: 'Pattern',
          name: `${TEST_PREFIX}_TestPattern`,
          description: 'Test pattern for E2E testing',
          project: 'E2E_TEST',
          domain: 'testing',
          visibility: 'private',
          patternType: 'design',
          problem: 'Test problem',
          solution: 'Test solution',
          examples: ['Example 1'],
          antiPatterns: [],
        }),
      });
      
      this.assertStatus(response, 201);
      const data = await response.json();
      patternId = data.data.id;
      this.createdVertexIds.push(patternId);
    });

    // List vertices
    await this.runTest('Knowledge - List Vertices', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge?op=list&limit=10`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data, 'success', 'boolean');
      this.assertProperty(data, 'data', 'array');
    });

    // Get specific vertex
    await this.runTest('Knowledge - Get Vertex by ID', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge?op=get&id=${functionId}`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data.data, 'id', 'string');
      this.assert(data.data.id === functionId, 'Should return correct vertex');
    });

    // Update vertex
    await this.runTest('Knowledge - Update Vertex', async () => {
      console.log(`    Updating vertex with ID: ${functionId}`);
      const response = await fetch(`${API_BASE_URL}/knowledge?id=${functionId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          description: 'Updated description for E2E test',
        }),
      });
      
      if (response.status !== 200) {
        const error = await response.text();
        throw new Error(`Update failed with ${response.status}: ${error}`);
      }
      
      const data = await response.json();
      console.log(`    Update response:`, JSON.stringify(data, null, 2));
      this.assert(
        data.data.description === 'Updated description for E2E test',
        `Description should be updated. Got: ${data.data.description}`
      );
    });

    // Test invalid operations
    await this.runTest('Knowledge - Create Without Required Fields', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          type: 'Function',
          // Missing required 'name' field
        }),
      });
      
      this.assertStatus(response, 400);
    });

    await this.runTest('Knowledge - Get Non-Existent Vertex', async () => {
      const response = await fetch(`${API_BASE_URL}/knowledge?op=get&id=non-existent-id`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 404);
    });
  }

  /**
   * Test Relationships API
   */
  private async testRelationshipsAPI(): Promise<void> {
    console.log(`\n${colors.cyan}📋 Testing Relationships API${colors.reset}`);

    // Need at least 2 vertices to create relationships
    if (this.createdVertexIds.length < 2) {
      console.log(`${colors.yellow}⚠️  Skipping relationship tests (need at least 2 vertices)${colors.reset}`);
      return;
    }

    const [fromId, toId] = this.createdVertexIds;

    // Create edge
    await this.runTest('Relationships - Create CALLS Edge', async () => {
      const response = await fetch(`${API_BASE_URL}/relationships`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          fromVertexId: fromId,
          toVertexId: toId,
          type: 'CALLS',
          visibility: 'private',
        }),
      });
      
      this.assertStatus(response, 201);
      const data = await response.json();
      this.assertProperty(data, 'success', 'boolean');
      
      this.createdEdges.push({ fromId, toId, type: 'CALLS' });
    });

    // Create BELONGS_TO edge
    await this.runTest('Relationships - Create BELONGS_TO Edge', async () => {
      const response = await fetch(`${API_BASE_URL}/relationships`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          fromVertexId: toId,
          toVertexId: fromId,
          type: 'BELONGS_TO',
          visibility: 'private',
          role: 'member',
          responsibilities: ['testing'],
        }),
      });
      
      this.assertStatus(response, 201);
      this.createdEdges.push({ fromId: toId, toId: fromId, type: 'BELONGS_TO' });
    });

    // Query edges from vertex
    await this.runTest('Relationships - Get Edges From Vertex', async () => {
      const response = await fetch(`${API_BASE_URL}/relationships?op=from&from=${fromId}`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data, 'data', 'array');
      this.assert(data.data.length > 0, 'Should have at least one edge');
    });

    // Graph traversal
    await this.runTest('Relationships - Traverse Graph', async () => {
      const response = await fetch(`${API_BASE_URL}/relationships?op=traverse&from=${fromId}&depth=2`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data, 'data', 'array');
    });

    // Test error cases
    await this.runTest('Relationships - Create Edge Without Required Fields', async () => {
      const response = await fetch(`${API_BASE_URL}/relationships`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          fromVertexId: fromId,
          // Missing toVertexId and type
        }),
      });
      
      this.assertStatus(response, 400);
    });

    await this.runTest('Relationships - Create Edge With Non-Existent Vertex', async () => {
      const response = await fetch(`${API_BASE_URL}/relationships`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify({
          fromVertexId: 'non-existent-id',
          toVertexId: toId,
          type: 'CALLS',
          visibility: 'private',
        }),
      });
      
      // Should fail with 404 (not found) or 403 (insufficient permissions) depending on implementation
      this.assert(
        response.status === 404 || response.status === 403,
        `Expected 404 or 403, got ${response.status}`
      );
    });
  }

  /**
   * Test Search API
   */
  private async testSearchAPI(): Promise<void> {
    console.log(`\n${colors.cyan}📋 Testing Search API${colors.reset}`);

    // Domain search
    await this.runTest('Search - Domain Search', async () => {
      const response = await fetch(`${API_BASE_URL}/search/advanced?type=domain&domain=testing`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data, 'success', 'boolean');
      this.assertProperty(data, 'results', 'array');
    });

    // Tag search
    await this.runTest('Search - Tag Search', async () => {
      const response = await fetch(`${API_BASE_URL}/search/advanced?type=tag&tag=test`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data, 'success', 'boolean');
    });

    // Project search
    await this.runTest('Search - Project Search', async () => {
      const response = await fetch(`${API_BASE_URL}/search/advanced?type=project&project=E2E_TEST`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data, 'success', 'boolean');
    });

    // Search with pagination
    await this.runTest('Search - With Pagination', async () => {
      const response = await fetch(`${API_BASE_URL}/search/advanced?type=domain&domain=testing&limit=5&offset=0`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 200);
      const data = await response.json();
      this.assertProperty(data, 'success', 'boolean');
    });

    // Invalid search type
    await this.runTest('Search - Invalid Search Type', async () => {
      const response = await fetch(`${API_BASE_URL}/search/advanced?type=invalid`, {
        method: 'GET',
        headers: { 'Cookie': this.sessionCookie },
      });
      
      this.assertStatus(response, 400);
    });

    // Graph traversal search (if vertex exists)
    if (this.createdVertexIds.length > 0) {
      await this.runTest('Search - Graph Traversal', async () => {
        const response = await fetch(
          `${API_BASE_URL}/search/advanced?type=traversal&startId=${this.createdVertexIds[0]}&depth=2`,
          {
            method: 'GET',
            headers: { 'Cookie': this.sessionCookie },
          }
        );
        
        if (response.status !== 200) {
          const error = await response.text();
          throw new Error(`Graph traversal failed with ${response.status}: ${error}`);
        }
        
        const data = await response.json();
        this.assertProperty(data, 'success', 'boolean');
        this.assertProperty(data, 'results', 'array');
      });
    }
  }

  /**
   * Cleanup all test data
   */
  private async cleanup(): Promise<void> {
    console.log(`\n${colors.cyan}🧹 Cleaning up test data...${colors.reset}`);
    
    let cleanedVertices = 0;
    let cleanedEdges = 0;
    let failedCleanups: string[] = [];

    // Note: We don't delete edges explicitly as they're removed when vertices are deleted
    // Delete vertices (this will cascade delete edges)
    for (const vertexId of this.createdVertexIds) {
      try {
        const response = await fetch(`${API_BASE_URL}/knowledge?id=${vertexId}`, {
          method: 'DELETE',
          headers: { 'Cookie': this.sessionCookie },
        });
        
        if (response.ok) {
          cleanedVertices++;
        } else {
          failedCleanups.push(`Vertex ${vertexId}: ${response.status}`);
        }
      } catch (error) {
        failedCleanups.push(`Vertex ${vertexId}: ${error}`);
      }
    }

    console.log(`${colors.green}✅ Cleaned up ${cleanedVertices} vertices${colors.reset}`);
    
    if (failedCleanups.length > 0) {
      console.log(`${colors.yellow}⚠️  Failed to clean up:${colors.reset}`);
      failedCleanups.forEach(failure => {
        console.log(`  ${colors.gray}${failure}${colors.reset}`);
      });
    }
  }

  /**
   * Test execution wrapper
   */
  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    this.testReport.totalTests++;
    
    try {
      await testFn();
      this.testReport.passed.push(testName);
      this.testReport.passedCount++;
      console.log(`  ${colors.green}✅ ${testName}${colors.reset}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testReport.failed.push({ test: testName, error: errorMessage });
      this.testReport.failedCount++;
      console.log(`  ${colors.red}❌ ${testName}${colors.reset}`);
      console.log(`     ${colors.gray}${errorMessage}${colors.reset}`);
    }
  }

  /**
   * Assertion helpers
   */
  private assertStatus(response: any, expectedStatus: number): void {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
  }

  private assertProperty(obj: any, property: string, type: string): void {
    if (!(property in obj)) {
      throw new Error(`Missing property: ${property}`);
    }
    
    const actualType = Array.isArray(obj[property]) ? 'array' : typeof obj[property];
    if (type === 'array' && !Array.isArray(obj[property])) {
      throw new Error(`Property ${property} should be an array`);
    } else if (type !== 'array' && actualType !== type) {
      throw new Error(`Property ${property} should be ${type}, got ${actualType}`);
    }
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    const duration = ((this.testReport.endTime! - this.testReport.startTime) / 1000).toFixed(2);
    const passRate = ((this.testReport.passedCount / this.testReport.totalTests) * 100).toFixed(1);

    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}📊 Test Summary${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);

    console.log(`Total Tests: ${this.testReport.totalTests}`);
    console.log(`${colors.green}Passed: ${this.testReport.passedCount}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.testReport.failedCount}${colors.reset}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration: ${duration}s`);

    if (this.testReport.failedCount === 0) {
      console.log(`\n${colors.green}🎉 All tests passed!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
      this.testReport.failed.forEach(({ test, error }) => {
        console.log(`  ${colors.red}• ${test}${colors.reset}`);
        console.log(`    ${colors.gray}${error}${colors.reset}`);
      });
    }

    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
  }
}

// Run the tests
const runner = new E2ETestRunner();
runner.run();