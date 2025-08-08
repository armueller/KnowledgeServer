#!/usr/bin/env node

/**
 * Migration Script: RMWM Context Database to Neptune
 * 
 * Migrates data from RMWM SQLite context database to KnowledgeServer Neptune
 * using API endpoints (simulating user behavior) rather than direct database manipulation.
 * 
 * This approach validates our entire stack end-to-end: SQLite → API → Neptune → Query
 */

import Database from 'better-sqlite3';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const RMWM_DB_PATH = '/Users/austinmueller/Git/RMWM/context-db/context.db';
const API_BASE_URL = 'https://knowledge-server-dev.tabus10.com/api'; // Deployed dev environment
const BATCH_SIZE = 5; // Process items in smaller batches to avoid overwhelming the API
const DELAY_MS = 200; // Delay between API calls to be gentle

// Authentication credentials (should be environment variables in production)
const AUTH_USERNAME = process.env.MIGRATION_USERNAME || '';
const AUTH_PASSWORD = process.env.MIGRATION_PASSWORD || '';

// Test mode - set to true to process only one of each vertex type for validation
const TEST_MODE = process.argv.includes('--test');
const TEST_RELATIONSHIPS = process.argv.includes('--test-relationships');
const RELATIONSHIPS_ONLY = process.argv.includes('--relationships-only');
const SAVE_FAILED_ITEMS = !process.argv.includes('--no-save-failed');

interface MigrationStats {
  functions: { total: number; migrated: number; skipped: number; errors: number };
  models: { total: number; migrated: number; skipped: number; errors: number };
  architecture: { total: number; migrated: number; skipped: number; errors: number };
  codePatterns: { total: number; migrated: number; skipped: number; errors: number };
  domainKnowledge: { total: number; migrated: number; skipped: number; errors: number };
  relationships: { total: number; migrated: number; skipped: number; errors: number };
}

interface FailedItem {
  type: string;
  name: string;
  id?: number;
  error: string;
  data?: any;
}

interface MigratedVertex {
  neptuneId: string;
  sqliteId: number;
  name: string;
  type: string;
}

class RMWMMigrator {
  private db: Database.Database;
  private stats: MigrationStats;
  private migratedVertices: Map<string, MigratedVertex> = new Map(); // key: "${type}_${sqliteId}"
  private existingFunctions = new Map<string, any>(); // name -> function data
  private existingModels = new Map<string, any>(); // name -> model data
  private sessionCookie: string = ''; // Store authentication cookie
  private failedItems: FailedItem[] = []; // Track failed items for retry

  constructor() {
    this.db = new Database(RMWM_DB_PATH, { readonly: true });
    this.stats = {
      functions: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      models: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      architecture: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      codePatterns: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      domainKnowledge: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      relationships: { total: 0, migrated: 0, skipped: 0, errors: 0 }
    };
  }

  /**
   * Use Claude Code to analyze source file and enhance SQLite data
   */
  private async analyzeWithClaude(
    sqliteData: any, 
    filePath: string, 
    analysisType: 'function' | 'model'
  ): Promise<any> {
    try {
      // Check if file exists and is accessible
      let sourceCode = '';
      // Fix file path by replacing .. with .$ticker. (SQLite stores dynamic routes with .. instead of .$ticker.)
      // Use simple string replacement to avoid regex escaping issues
      const normalizedPath = filePath.split('..').join('.$ticker.');
      const fullPath = join('/Users/austinmueller/Git/RMWM', normalizedPath);
      
      // Debug log for file path issues
      if (filePath.includes('..')) {
        console.log(`      📝 Path normalization: ${filePath} → ${normalizedPath}`);
      }
      
      try {
        sourceCode = await readFile(fullPath, 'utf-8');
      } catch (fileError) {
        console.warn(`   📄 Could not read file ${normalizedPath} (original: ${filePath}), using SQLite data only`);
        console.warn(`      Full path attempted: ${fullPath}`);
        return this.fallbackToSqliteData(sqliteData, analysisType);
      }

      const prompt = this.createAnalysisPrompt(sqliteData, filePath, sourceCode, analysisType);
      
      // Call Claude Code via subprocess
      const claudeResponse = await this.callClaudeCode(prompt);
      
      // Parse and validate Claude's response
      return this.parseClaudeResponse(claudeResponse, sqliteData, analysisType);
      
    } catch (error) {
      console.warn(`   🤖 Claude analysis failed for ${filePath}:`, error.message);
      return this.fallbackToSqliteData(sqliteData, analysisType);
    }
  }

  /**
   * Create analysis prompt for Claude based on data type
   */
  private createAnalysisPrompt(
    sqliteData: any, 
    filePath: string, 
    sourceCode: string, 
    analysisType: 'function' | 'model'
  ): string {
    if (analysisType === 'function') {
      return `Please analyze this TypeScript function and return enhanced data in JSON format.

TASK: Read the source code, validate the SQLite data, and return a complete JSON object matching the Neptune Function vertex schema.

FILE PATH: ${filePath}
FUNCTION NAME: ${sqliteData.name}

SQLITE DATA:
${JSON.stringify(sqliteData, null, 2)}

SOURCE CODE:
\`\`\`typescript
${sourceCode}
\`\`\`

REQUIREMENTS:
1. Return ONLY a valid JSON object, no other text
2. Analyze the actual function code to determine:
   - isPure: true if function has no side effects (no DOM manipulation, no external calls, no mutations)
   - sideEffects: array of side effects like ["DOM", "API", "state", "console", "filesystem"]
   - parameters: extract actual parameter names and types from function signature
   - returnType: actual return type from TypeScript
   - isAsync: true if function is async or returns Promise
   - Better description based on code analysis

JSON SCHEMA TO MATCH:
{
  "type": "Function",
  "name": "string",
  "description": "string (enhanced from code analysis)",
  "filePath": "string",
  "signature": "string", 
  "isAsync": boolean,
  "isPure": boolean,
  "lineStart": number,
  "lineEnd": number,
  "returnType": "string",
  "parameters": ["string array of parameter names"],
  "sideEffects": ["array of side effect categories"],
  "project": "RMWM",
  "domain": "code",
  "visibility": "private",
  "accessLevel": "write",
  "tags": ["array", "of", "tags"],
  "keywords": ["array", "of", "keywords"],
  "status": "active",
  "confidence": 1.0,
  "version": "1.0.0"
}

Return the enhanced JSON object:`;
    } else {
      return `Please analyze this TypeScript model/interface and return enhanced data in JSON format.

TASK: Read the source code, validate the SQLite data, and return a complete JSON object matching the Neptune Model vertex schema.

FILE PATH: ${filePath}
MODEL NAME: ${sqliteData.name}

SQLITE DATA:
${JSON.stringify(sqliteData, null, 2)}

SOURCE CODE:
\`\`\`typescript
${sourceCode}
\`\`\`

REQUIREMENTS:
1. Return ONLY a valid JSON object, no other text
2. Analyze the actual model/interface code to determine:
   - modelType: "interface", "type", "class", or "enum" 
   - properties: array of properties WITH their types like ["pk: string", "price: number", "isActive: boolean"]
   - methods: array of method signatures like ["calculate(): number", "validate(input: string): boolean"]
   - extends: what this model extends (as array)
   - implements: what this model implements (as array)
   - Better description based on code analysis

JSON SCHEMA TO MATCH:
{
  "type": "Model",
  "name": "string",
  "description": "string (enhanced from code analysis)",
  "filePath": "string",
  "modelType": "interface|type|class|enum",
  "properties": ["propName: propType", "pk: string", "price: number"],
  "methods": ["methodName(): returnType"],
  "extends": ["BaseType"] or undefined,
  "implements": ["Interface1"] or undefined,
  "lineStart": number,
  "lineEnd": number,
  "project": "RMWM",
  "domain": "code", 
  "visibility": "private",
  "accessLevel": "write",
  "tags": ["array", "of", "tags"],
  "keywords": ["array", "of", "keywords"],
  "status": "active",
  "confidence": 1.0,
  "version": "1.0.0"
}

Return the enhanced JSON object:`;
    }
  }

  /**
   * Call Claude Code as subprocess
   */
  private async callClaudeCode(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Log the prompt being sent to Claude (truncated for readability)
      if (TEST_MODE) {
        console.log('      📝 Claude prompt preview:', prompt.substring(0, 200) + '...');
      }
      
      const claude = spawn('claude', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: '/Users/austinmueller/Git/RMWM' // Run from RMWM directory so Claude can access files
      });

      let output = '';
      let errorOutput = '';

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          // Log the raw Claude response in test mode
          if (TEST_MODE) {
            console.log('      📤 Claude raw response:', output.trim());
          }
          resolve(output.trim());
        } else {
          reject(new Error(`Claude process exited with code ${code}: ${errorOutput}`));
        }
      });

      claude.on('error', (error) => {
        reject(new Error(`Failed to spawn Claude process: ${error.message}`));
      });

      // Send prompt to Claude
      claude.stdin.write(prompt);
      claude.stdin.end();
    });
  }

  /**
   * Parse and validate Claude's JSON response
   */
  private parseClaudeResponse(claudeResponse: string, sqliteData: any, analysisType: string): any {
    try {
      // Extract JSON from Claude's response 
      // Claude may wrap response in ```json ... ``` blocks
      let jsonMatch = claudeResponse.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonString: string;
      
      if (jsonMatch) {
        // Found JSON in code block
        jsonString = jsonMatch[1];
      } else {
        // Try to find raw JSON object
        jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in Claude response');
        }
        jsonString = jsonMatch[0];
      }

      // Clean up undefined values in JSON string before parsing
      // Claude sometimes returns undefined which isn't valid JSON
      const cleanedJson = jsonString
        .replace(/:\s*undefined/g, ': null')
        .replace(/,\s*undefined/g, ', null');
      
      // Log the cleaned JSON in test mode
      if (TEST_MODE) {
        console.log('      🧹 Cleaned JSON:', cleanedJson);
      }
      
      const enhanced = JSON.parse(cleanedJson);
      
      // CRITICAL: Override security fields to prevent Claude from setting them incorrectly
      // These fields should NEVER be controlled by AI output
      enhanced.visibility = 'private';  // ALWAYS private for migrated data
      enhanced.accessLevel = 'write';   // ALWAYS write for migrated data
      
      // Remove any tenant/user fields that Claude might have added
      delete enhanced.tenantId;
      delete enhanced.userId;
      delete enhanced.teamId;
      
      // Validate required fields are present
      if (!enhanced.type || !enhanced.name || !enhanced.description) {
        throw new Error('Missing required fields in Claude response');
      }

      console.log(`   🤖 Claude enhanced ${analysisType}: ${enhanced.name} (forced visibility: private)`);
      return enhanced;
      
    } catch (parseError) {
      console.warn(`   ⚠️  Failed to parse Claude response: ${parseError.message}`);
      throw parseError;
    }
  }

  /**
   * Fallback to SQLite data if Claude analysis fails
   */
  private fallbackToSqliteData(sqliteData: any, analysisType: 'function' | 'model'): any {
    if (analysisType === 'function') {
      return {
        type: 'Function',
        name: sqliteData.name,
        description: sqliteData.description || '',
        filePath: sqliteData.file_path || '',
        signature: sqliteData.signature || '',
        isAsync: !!sqliteData.is_async,
        isPure: false, // Conservative default
        lineStart: sqliteData.line_number || 0,
        lineEnd: sqliteData.line_number || 0,
        returnType: sqliteData.return_type || 'void',
        parameters: sqliteData.parameters ? 
          JSON.parse(sqliteData.parameters).map((p: any) => typeof p === 'string' ? p : JSON.stringify(p)) : [],
        sideEffects: [], // Unknown, leave empty
        project: 'RMWM',
        domain: 'code',
        visibility: 'private',
        accessLevel: 'write',
        tags: sqliteData.tags ? sqliteData.tags.split(',').map((t: string) => t.trim()) : [],
        keywords: [],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      };
    } else {
      // Parse properties object to get property names WITH types as string array
      let propertiesArray: string[] = [];
      if (sqliteData.properties) {
        try {
          const propsObj = JSON.parse(sqliteData.properties);
          // Include property types if available
          propertiesArray = Object.entries(propsObj).map(([key, value]) => `${key}: ${value}`);
        } catch {
          propertiesArray = [];
        }
      }

      return {
        type: 'Model',
        name: sqliteData.name,
        description: `${sqliteData.model_type}: ${sqliteData.description}`,
        filePath: sqliteData.file_path || '',
        modelType: sqliteData.model_type || 'interface',
        properties: propertiesArray,
        methods: [], // SQLite doesn't track methods separately
        extends: sqliteData.extends_from ? [sqliteData.extends_from] : undefined,
        implements: undefined,
        // Required from CodeArtifactBase
        lineStart: sqliteData.line_number || 0,
        lineEnd: sqliteData.line_number || 0,
        // BaseVertex fields
        project: 'RMWM',
        domain: 'code',
        visibility: 'private',
        accessLevel: 'write',
        tags: sqliteData.tags ? 
          [...sqliteData.tags.split(',').map((t: string) => t.trim()), 'model', sqliteData.model_type] :
          ['model', sqliteData.model_type],
        keywords: [sqliteData.model_type, 'model'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      };
    }
  }

  private async loadExistingItems(): Promise<void> {
    console.log('📥 Loading existing items from Neptune to avoid re-migration...');
    
    try {
      // Get all functions
      const functionsResponse = await fetch(`${API_BASE_URL}/knowledge?type=Function&limit=200`, {
        headers: { 'Cookie': this.sessionCookie },
      });
      
      if (functionsResponse.ok) {
        const functionsData = await functionsResponse.json();
        console.log(`   📦 Found ${functionsData.data.length} existing functions`);
        
        for (const func of functionsData.data) {
          this.existingFunctions.set(func.name, func);
        }
      }
      
      // Get all models
      const modelsResponse = await fetch(`${API_BASE_URL}/knowledge?type=Model&limit=100`, {
        headers: { 'Cookie': this.sessionCookie },
      });
      
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        console.log(`   📦 Found ${modelsData.data.length} existing models`);
        
        for (const model of modelsData.data) {
          this.existingModels.set(model.name, model);
        }
      }
      
    } catch (error) {
      console.warn('   ⚠️  Could not load existing items, will check individually:', error);
    }
    
    console.log('✅ Existing items loaded\n');
  }

  private async loadExistingVertices(): Promise<void> {
    console.log('📥 Loading existing vertices from Neptune...');
    
    try {
      // Get functions
      const functionsResponse = await fetch(`${API_BASE_URL}/knowledge?type=Function&limit=200`, {
        headers: {
          'Cookie': this.sessionCookie,
        },
      });
      
      if (functionsResponse.ok) {
        const functionsData = await functionsResponse.json();
        console.log(`   📦 Found ${functionsData.data.length} functions`);
        
        // Map Neptune vertices back to SQLite IDs based on name
        const functionsByName = this.db.prepare('SELECT id, name FROM functions').all();
        const nameToId = new Map(functionsByName.map((f: any) => [f.name, f.id]));
        
        for (const func of functionsData.data) {
          const sqliteId = nameToId.get(func.name);
          if (sqliteId) {
            this.migratedVertices.set(`function_${sqliteId}`, {
              neptuneId: func.id,
              sqliteId,
              name: func.name,
              type: 'Function'
            });
          }
        }
      }
      
      // Get models
      const modelsResponse = await fetch(`${API_BASE_URL}/knowledge?type=Model&limit=200`, {
        headers: {
          'Cookie': this.sessionCookie,
        },
      });
      
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        console.log(`   📦 Found ${modelsData.data.length} models`);
        
        const modelsByName = this.db.prepare('SELECT id, name FROM models').all();
        const modelNameToId = new Map(modelsByName.map((m: any) => [m.name, m.id]));
        
        for (const model of modelsData.data) {
          const sqliteId = modelNameToId.get(model.name);
          if (sqliteId) {
            this.migratedVertices.set(`model_${sqliteId}`, {
              neptuneId: model.id,
              sqliteId,
              name: model.name,
              type: 'Model'
            });
          }
        }
      }
      
      console.log(`   ✅ Loaded ${this.migratedVertices.size} vertex mappings`);
    } catch (error) {
      console.error('❌ Failed to load existing vertices:', error);
      throw error;
    }
  }
  
  async migrate(): Promise<void> {
    console.log('🚀 Starting RMWM Context Database Migration to Neptune');
    console.log(`📊 Source: ${RMWM_DB_PATH}`);
    console.log(`🎯 Target: ${API_BASE_URL}`);
    if (!RELATIONSHIPS_ONLY) {
      console.log('🤖 Using Claude Code for intelligent source code analysis');
    }
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Processing only one of each vertex type for validation');
    }
    if (TEST_RELATIONSHIPS) {
      console.log('🔗 RELATIONSHIP TEST MODE: Will migrate a few vertices and test relationships between them');
    }
    if (RELATIONSHIPS_ONLY) {
      console.log('🔗 RELATIONSHIPS ONLY MODE: Will only migrate relationships using existing vertices');
    }
    console.log('');

    try {
      // Authenticate first to get session cookie
      await this.authenticate();
      
      // Check API connectivity
      await this.checkApiConnectivity();
      
      // Get migration statistics
      await this.gatherStats();
      
      // Load existing functions and models to avoid re-migration
      await this.loadExistingItems();
      this.printStats();

      // Migrate data in order (vertices first, then relationships)
      console.log('📦 Starting data migration...\n');
      
      if (RELATIONSHIPS_ONLY) {
        // Load existing vertices from Neptune instead of migrating new ones
        await this.loadExistingVertices();
      } else if (TEST_RELATIONSHIPS) {
        // In relationship test mode, only migrate functions and models (which have relationships)
        console.log('🧪 Relationship test mode: migrating only functions and models');
        await this.migrateFunctions();
        await this.migrateModels();
        // Skip other vertex types in relationship test mode
      } else {
        // Normal migration (full or test mode)
        await this.migrateFunctions();
        await this.migrateModels();
        await this.migrateArchitecture();
        await this.migrateCodePatterns();
        await this.migrateDomainKnowledge();
      }
      
      // Now migrate relationships between the vertices
      await this.migrateRelationships();
      
      await this.printFinalResults();

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      this.db.close();
    }
  }

  private async authenticate(): Promise<void> {
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

  private async checkApiConnectivity(): Promise<void> {
    console.log('🔍 Checking API connectivity...');
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge?op=list&limit=1`, {
        headers: { 
          'Cookie': this.sessionCookie,
        }
      });
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      console.log('✅ API connectivity confirmed\n');
    } catch (error) {
      console.error('❌ Cannot connect to KnowledgeServer API');
      console.error('💡 Make sure the server is running and you are authenticated');
      throw error;
    }
  }

  private async gatherStats(): Promise<void> {
    console.log('📈 Gathering migration statistics...');
    
    const tables = [
      { name: 'functions', key: 'functions' },
      { name: 'models', key: 'models' },
      { name: 'architecture', key: 'architecture' },
      { name: 'code_patterns', key: 'codePatterns' },
      { name: 'domain_knowledge', key: 'domainKnowledge' }
    ] as const;

    for (const table of tables) {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
      this.stats[table.key].total = result.count;
    }

    // Count relationships
    const relationshipTables = ['function_dependencies', 'function_models', 'model_dependencies'];
    let totalRelationships = 0;
    for (const table of relationshipTables) {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      totalRelationships += result.count;
    }
    this.stats.relationships.total = totalRelationships;
  }

  private printStats(): void {
    console.log('📊 Migration Overview:');
    console.log(`   Functions: ${this.stats.functions.total}`);
    console.log(`   Models: ${this.stats.models.total}`);
    console.log(`   Architecture Patterns: ${this.stats.architecture.total}`);
    console.log(`   Code Patterns: ${this.stats.codePatterns.total}`);
    console.log(`   Domain Knowledge: ${this.stats.domainKnowledge.total}`);
    console.log(`   Relationships: ${this.stats.relationships.total}`);
    console.log('');
  }

  private async migrateFunctions(): Promise<void> {
    console.log('⚙️  Migrating Functions...');
    
    const query = `
      SELECT f.*, GROUP_CONCAT(DISTINCT t.name) as tags,
             GROUP_CONCAT(DISTINCT fl.library_name) as libraries
      FROM functions f
      LEFT JOIN function_tags ft ON f.id = ft.function_id
      LEFT JOIN tags t ON ft.tag_id = t.id
      LEFT JOIN function_libraries fl ON f.id = fl.function_id
      GROUP BY f.id
      ORDER BY f.id
    `;
    
    const functions = this.db.prepare(query).all();
    
    // In test mode, only process a sample
    let functionsToProcess = functions;
    if (TEST_MODE) {
      functionsToProcess = functions.slice(0, 1);
    } else if (TEST_RELATIONSHIPS) {
      functionsToProcess = functions.slice(0, 5); // Process 5 functions for relationship testing
    }
    
    // Process functions sequentially to avoid overwhelming Claude subprocess
    for (let i = 0; i < functionsToProcess.length; i++) {
      await this.migrateFunction(functionsToProcess[i]);
      
      // Progress indicator every 5 functions
      if ((i + 1) % 5 === 0 || i === functionsToProcess.length - 1) {
        console.log(`   📦 ${i + 1}/${functionsToProcess.length} functions processed`);
      }
      
      // Brief delay between Claude calls
      if (i < functionsToProcess.length - 1) {
        await this.delay(DELAY_MS);
      }
    }
  }

  private async migrateFunction(sqliteFunc: any): Promise<void> {
    try {
      // Check if function already exists in Neptune (pre-loaded)
      const existing = this.existingFunctions.get(sqliteFunc.name);
      if (existing) {
        console.log(`   ⏭️  Function ${sqliteFunc.name} already exists, skipping`);
        this.stats.functions.skipped++;
        
        // Still track for relationship creation
        this.migratedVertices.set(`function_${sqliteFunc.id}`, {
          neptuneId: existing.id,
          sqliteId: sqliteFunc.id,
          name: sqliteFunc.name,
          type: 'Function'
        });
        return;
      }
      
      // Use Claude to analyze the source file and enhance the SQLite data
      console.log(`   🔍 Analyzing function: ${sqliteFunc.name}`);
      const neptuneFunction = await this.analyzeWithClaude(
        sqliteFunc, 
        sqliteFunc.file_path, 
        'function'
      );

      // Log the final JSON being sent to API in test mode
      if (TEST_MODE) {
        console.log('      📨 Sending to API:', JSON.stringify(neptuneFunction, null, 2));
      }
      
      // Call our API to create the function
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(neptuneFunction)
      });

      if (response.ok) {
        const result = await response.json();
        this.stats.functions.migrated++;
        
        // Track migrated vertex for relationship creation
        this.migratedVertices.set(`function_${sqliteFunc.id}`, {
          neptuneId: result.data.id,
          sqliteId: sqliteFunc.id,
          name: sqliteFunc.name,
          type: 'Function'
        });
      } else if (response.status === 409) {
        // Already exists, skip
        this.stats.functions.skipped++;
      } else {
        const error = await response.text();
        console.warn(`   ⚠️  Failed to migrate function ${sqliteFunc.name}: ${error}`);
        this.stats.functions.errors++;
        this.failedItems.push({
          type: 'function',
          name: sqliteFunc.name,
          id: sqliteFunc.id,
          error,
          data: neptuneFunction
        });
      }
    } catch (error) {
      console.warn(`   ⚠️  Error migrating function ${sqliteFunc.name}:`, error);
      this.stats.functions.errors++;
      this.failedItems.push({
        type: 'function',
        name: sqliteFunc.name,
        id: sqliteFunc.id,
        error: error instanceof Error ? error.message : String(error),
        data: enhanced
      });
    }
  }

  private async migrateModels(): Promise<void> {
    console.log('🏗️  Migrating Models...');
    
    const query = `
      SELECT m.*, GROUP_CONCAT(DISTINCT t.name) as tags
      FROM models m
      LEFT JOIN model_tags mt ON m.id = mt.model_id
      LEFT JOIN tags t ON mt.tag_id = t.id
      GROUP BY m.id
      ORDER BY m.id
    `;
    
    const models = this.db.prepare(query).all();
    
    // In test mode, only process a sample
    let modelsToProcess = models;
    if (TEST_MODE) {
      modelsToProcess = models.slice(0, 1);
    } else if (TEST_RELATIONSHIPS) {
      modelsToProcess = models.slice(0, 5); // Process 5 models for relationship testing
    }
    
    // Process models sequentially to avoid overwhelming Claude subprocess
    for (let i = 0; i < modelsToProcess.length; i++) {
      await this.migrateModel(modelsToProcess[i]);
      
      // Progress indicator every 5 models
      if ((i + 1) % 5 === 0 || i === modelsToProcess.length - 1) {
        console.log(`   📦 ${i + 1}/${modelsToProcess.length} models processed`);
      }
      
      // Brief delay between Claude calls
      if (i < modelsToProcess.length - 1) {
        await this.delay(DELAY_MS);
      }
    }
  }

  private async migrateModel(sqliteModel: any): Promise<void> {
    try {
      // Check if model already exists in Neptune (pre-loaded)
      const existing = this.existingModels.get(sqliteModel.name);
      if (existing) {
        console.log(`   ⏭️  Model ${sqliteModel.name} already exists, skipping`);
        this.stats.models.skipped++;
        
        // Still track for relationship creation
        this.migratedVertices.set(`model_${sqliteModel.id}`, {
          neptuneId: existing.id,
          sqliteId: sqliteModel.id,
          name: sqliteModel.name,
          type: 'Model'
        });
        return;
      }
      
      // Use Claude to analyze the source file and enhance the SQLite data
      console.log(`   🔍 Analyzing model: ${sqliteModel.name}`);
      const neptuneModel = await this.analyzeWithClaude(
        sqliteModel, 
        sqliteModel.file_path, 
        'model'
      );

      // Log the final JSON being sent to API in test mode
      if (TEST_MODE) {
        console.log('      📨 Sending to API:', JSON.stringify(neptuneModel, null, 2));
      }
      
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(neptuneModel)
      });

      if (response.ok) {
        const result = await response.json();
        this.stats.models.migrated++;
        
        // Track migrated vertex for relationship creation
        this.migratedVertices.set(`model_${sqliteModel.id}`, {
          neptuneId: result.data.id,
          sqliteId: sqliteModel.id,
          name: sqliteModel.name,
          type: 'Model'
        });
      } else if (response.status === 409) {
        this.stats.models.skipped++;
      } else {
        const error = await response.text();
        console.warn(`   ⚠️  Failed to migrate model ${sqliteModel.name}: ${error}`);
        this.stats.models.errors++;
        this.failedItems.push({
          type: 'model',
          name: sqliteModel.name,
          id: sqliteModel.id,
          error,
          data: neptuneFunction
        });
      }
    } catch (error) {
      console.warn(`   ⚠️  Error migrating model ${sqliteModel.name}:`, error);
      this.stats.models.errors++;
      this.failedItems.push({
        type: 'model',
        name: sqliteModel.name,
        id: sqliteModel.id,
        error: error instanceof Error ? error.message : String(error),
        data: enhanced
      });
    }
  }

  private async migrateArchitecture(): Promise<void> {
    console.log('🏛️  Migrating Architecture Patterns...');
    
    const query = `
      SELECT a.*, GROUP_CONCAT(DISTINCT t.name) as tags
      FROM architecture a
      LEFT JOIN architecture_tags at ON a.id = at.architecture_id
      LEFT JOIN tags t ON at.tag_id = t.id
      GROUP BY a.id
      ORDER BY a.id
    `;
    
    const architectures = this.db.prepare(query).all();
    
    // In test mode, only process the first architecture pattern
    const architecturesToProcess = TEST_MODE ? architectures.slice(0, 1) : architectures;
    
    for (const arch of architecturesToProcess) {
      await this.migrateArchitecturePattern(arch);
    }
    
    console.log(`   📦 ${architecturesToProcess.length}/${architecturesToProcess.length} architecture patterns processed`);
  }

  private async migrateArchitecturePattern(sqliteArch: any): Promise<void> {
    try {
      // Architecture patterns as ArchitecturePattern vertices
      const neptuneArchitecture = {
        type: 'Pattern',
        patternType: 'architectural',
        name: sqliteArch.pattern_name,
        description: sqliteArch.description,
        problem: sqliteArch.purpose || '',
        solution: sqliteArch.implementation_details || sqliteArch.description,
        examples: sqliteArch.example_files ? sqliteArch.example_files.split(',') : [],
        antiPatterns: [],
        project: 'RMWM',
        domain: 'architecture',
        visibility: 'private', // All migration data is private initially
        accessLevel: 'write',
        tags: sqliteArch.tags ? 
          [...sqliteArch.tags.split(',').map((t: string) => t.trim()), 'architecture', 'pattern'] :
          ['architecture', 'pattern'],
        keywords: ['architecture', 'pattern', 'design'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      };

      // Log the final JSON being sent to API in test mode
      if (TEST_MODE) {
        console.log('      📨 Sending Architecture to API:', JSON.stringify(neptuneArchitecture, null, 2));
      }
      
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(neptuneArchitecture)
      });

      if (response.ok) {
        const result = await response.json();
        this.stats.architecture.migrated++;
        
        // Track migrated vertex
        this.migratedVertices.set(`architecture_${sqliteArch.id}`, {
          neptuneId: result.data.id,
          sqliteId: sqliteArch.id,
          name: sqliteArch.pattern_name,
          type: 'Pattern'
        });
      } else if (response.status === 409) {
        this.stats.architecture.skipped++;
      } else {
        const error = await response.text();
        console.warn(`   ⚠️  Failed to migrate architecture ${sqliteArch.pattern_name}: ${error}`);
        this.stats.architecture.errors++;
        this.failedItems.push({
          type: 'architecture',
          name: sqliteArch.pattern_name,
          id: sqliteArch.id,
          error,
          data: neptuneFunction
        });
      }
    } catch (error) {
      console.warn(`   ⚠️  Error migrating architecture ${sqliteArch.pattern_name}:`, error);
      this.stats.architecture.errors++;
      this.failedItems.push({
        type: 'architecture',
        name: sqliteArch.pattern_name,
        id: sqliteArch.id,
        error: error instanceof Error ? error.message : String(error),
        data: enhanced
      });
    }
  }

  private async migrateCodePatterns(): Promise<void> {
    console.log('🎨 Migrating Code Patterns...');
    
    const query = `
      SELECT cp.*, GROUP_CONCAT(DISTINCT t.name) as tags
      FROM code_patterns cp
      LEFT JOIN code_pattern_tags cpt ON cp.id = cpt.code_pattern_id
      LEFT JOIN tags t ON cpt.tag_id = t.id
      GROUP BY cp.id
      ORDER BY cp.id
    `;
    
    const patterns = this.db.prepare(query).all();
    
    // In test mode, only process the first code pattern
    const patternsToProcess = TEST_MODE ? patterns.slice(0, 1) : patterns;
    
    for (const pattern of patternsToProcess) {
      await this.migrateCodePattern(pattern);
    }
    
    console.log(`   📦 ${patternsToProcess.length}/${patternsToProcess.length} code patterns processed`);
  }

  private async migrateCodePattern(sqlitePattern: any): Promise<void> {
    try {
      // Code patterns as CodePattern vertices
      const neptuneCodePattern = {
        type: 'Pattern',
        patternType: 'code',
        name: sqlitePattern.pattern_name,
        description: sqlitePattern.description,
        problem: sqlitePattern.use_case || '',
        solution: sqlitePattern.implementation || sqlitePattern.example_code || '',
        examples: sqlitePattern.related_files ? sqlitePattern.related_files.split(',') : [],
        antiPatterns: sqlitePattern.anti_patterns ? sqlitePattern.anti_patterns.split(',') : [],
        project: 'RMWM',
        domain: 'code',
        visibility: 'private', // All migration data is private initially
        accessLevel: 'write',
        tags: sqlitePattern.tags ? 
          [...sqlitePattern.tags.split(',').map((t: string) => t.trim()), 'code-pattern', sqlitePattern.pattern_type] :
          ['code-pattern', sqlitePattern.pattern_type],
        keywords: ['pattern', 'code', sqlitePattern.pattern_type],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      };

      // Log the final JSON being sent to API in test mode
      if (TEST_MODE) {
        console.log('      📨 Sending Code Pattern to API:', JSON.stringify(neptuneCodePattern, null, 2));
      }
      
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(neptuneCodePattern)
      });

      if (response.ok) {
        const result = await response.json();
        this.stats.codePatterns.migrated++;
        
        // Track migrated vertex
        this.migratedVertices.set(`code_pattern_${sqlitePattern.id}`, {
          neptuneId: result.data.id,
          sqliteId: sqlitePattern.id,
          name: sqlitePattern.pattern_name,
          type: 'Pattern'
        });
      } else if (response.status === 409) {
        this.stats.codePatterns.skipped++;
      } else {
        const error = await response.text();
        console.warn(`   ⚠️  Failed to migrate code pattern ${sqlitePattern.pattern_name}: ${error}`);
        this.stats.codePatterns.errors++;
        this.failedItems.push({
          type: 'codePattern',
          name: sqlitePattern.pattern_name,
          id: sqlitePattern.id,
          error,
          data: neptuneFunction
        });
      }
    } catch (error) {
      console.warn(`   ⚠️  Error migrating code pattern ${sqlitePattern.pattern_name}:`, error);
      this.stats.codePatterns.errors++;
      this.failedItems.push({
        type: 'codePattern',
        name: sqlitePattern.pattern_name,
        id: sqlitePattern.id,
        error: error instanceof Error ? error.message : String(error),
        data: enhanced
      });
    }
  }

  private async migrateDomainKnowledge(): Promise<void> {
    console.log('📚 Migrating Domain Knowledge...');
    
    const query = `
      SELECT dk.*, GROUP_CONCAT(DISTINCT t.name) as tags
      FROM domain_knowledge dk
      LEFT JOIN domain_knowledge_tags dkt ON dk.id = dkt.domain_knowledge_id
      LEFT JOIN tags t ON dkt.tag_id = t.id
      GROUP BY dk.id
      ORDER BY dk.id
    `;
    
    const domainEntries = this.db.prepare(query).all();
    
    // In test mode, only process the first domain knowledge entry
    const domainEntriesToProcess = TEST_MODE ? domainEntries.slice(0, 1) : domainEntries;
    
    for (const entry of domainEntriesToProcess) {
      await this.migrateDomainEntry(entry);
    }
    
    console.log(`   📦 ${domainEntriesToProcess.length}/${domainEntriesToProcess.length} domain knowledge entries processed`);
  }

  private async migrateDomainEntry(sqliteEntry: any): Promise<void> {
    try {
      // Domain knowledge as DomainKnowledge vertices
      let description = sqliteEntry.description;
      if (sqliteEntry.key_concepts) {
        const concepts = JSON.parse(sqliteEntry.key_concepts);
        description += `\n\nKey Concepts: ${concepts.join(', ')}`;
      }
      if (sqliteEntry.examples) {
        description += `\n\nExamples: ${sqliteEntry.examples}`;
      }

      const neptuneDomainKnowledge = {
        type: 'Concept',
        conceptType: sqliteEntry.category || 'domain',
        name: sqliteEntry.title,
        description,
        definition: sqliteEntry.content || description,
        examples: sqliteEntry.examples ? sqliteEntry.examples.split('|') : [],
        relationships: sqliteEntry.related_topics ? sqliteEntry.related_topics.split(',') : [],
        synonyms: [],
        project: 'RMWM',
        domain: sqliteEntry.category, // Domain varies by category (trading-strategies, market-mechanics, etc.)
        visibility: 'private', // All migration data is private initially
        accessLevel: 'write', // Migration script needs write access
        tags: sqliteEntry.tags ? 
          [...sqliteEntry.tags.split(',').map((t: string) => t.trim()), 'domain-knowledge', sqliteEntry.category] :
          ['domain-knowledge', sqliteEntry.category],
        keywords: [sqliteEntry.topic, sqliteEntry.category, 'knowledge'],
        status: 'active',
        confidence: 1.0,
        version: '1.0.0'
      };

      // Log the final JSON being sent to API in test mode
      if (TEST_MODE) {
        console.log('      📨 Sending Domain Knowledge to API:', JSON.stringify(neptuneDomainKnowledge, null, 2));
      }
      
      const response = await fetch(`${API_BASE_URL}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(neptuneDomainKnowledge)
      });

      if (response.ok) {
        const result = await response.json();
        this.stats.domainKnowledge.migrated++;
        
        // Track migrated vertex
        this.migratedVertices.set(`domain_knowledge_${sqliteEntry.id}`, {
          neptuneId: result.data.id,
          sqliteId: sqliteEntry.id,
          name: sqliteEntry.title,
          type: 'Concept'
        });
      } else if (response.status === 409) {
        this.stats.domainKnowledge.skipped++;
      } else {
        const error = await response.text();
        console.warn(`   ⚠️  Failed to migrate domain knowledge ${sqliteEntry.topic}: ${error}`);
        this.stats.domainKnowledge.errors++;
        this.failedItems.push({
          type: 'domainKnowledge',
          name: sqliteEntry.topic,
          id: sqliteEntry.id,
          error,
          data: neptuneFunction
        });
      }
    } catch (error) {
      console.warn(`   ⚠️  Error migrating domain knowledge ${sqliteEntry.topic}:`, error);
      this.stats.domainKnowledge.errors++;
      this.failedItems.push({
        type: 'domainKnowledge',
        name: sqliteEntry.topic,
        id: sqliteEntry.id,
        error: error instanceof Error ? error.message : String(error),
        data: enhanced
      });
    }
  }

  private async migrateRelationships(): Promise<void> {
    if (TEST_MODE && !TEST_RELATIONSHIPS) {
      console.log('🔗 Skipping relationships in test mode (use --test-relationships to test them)');
      return;
    }
    
    if (TEST_RELATIONSHIPS) {
      console.log('\n🔗 Testing relationship migration with sample relationships...');
    } else {
      console.log('🔗 Migrating Relationships...');
    }
    
    // Function dependencies (function -> function relationships)
    await this.migrateFunctionDependencies();
    
    // Function models (function -> model relationships)  
    await this.migrateFunctionModels();
    
    // Model dependencies (model -> model relationships)
    await this.migrateModelDependencies();
  }

  private async migrateFunctionDependencies(): Promise<void> {
    console.log('   📞 Migrating function dependencies...');
    
    const query = `
      SELECT fd.*, 
             f1.name as function_name,
             f2.name as depends_on_function_name
      FROM function_dependencies fd
      JOIN functions f1 ON fd.function_id = f1.id
      JOIN functions f2 ON fd.depends_on_function_id = f2.id
    `;
    
    const dependencies = this.db.prepare(query).all();
    
    for (const dep of dependencies) {
      await this.migrateFunctionDependency(dep);
    }
    
    console.log(`      📦 ${dependencies.length} function dependencies processed`);
  }

  private async migrateFunctionDependency(sqliteDep: any): Promise<void> {
    try {
      const fromVertex = this.migratedVertices.get(`function_${sqliteDep.function_id}`);
      const toVertex = this.migratedVertices.get(`function_${sqliteDep.depends_on_function_id}`);
      
      if (!fromVertex || !toVertex) {
        console.warn(`   ⚠️  Skipping relationship: missing vertices for dependency ${sqliteDep.function_name} -> ${sqliteDep.depends_on_function_name}`);
        this.stats.relationships.errors++;
        return;
      }

      const relationshipType = sqliteDep.dependency_type === 'calls' ? 'CALLS' : 'DEPENDS_ON';
      
      const edgeData = {
        fromVertexId: fromVertex.neptuneId,
        toVertexId: toVertex.neptuneId,
        type: relationshipType,
        visibility: 'private', // Use private visibility to match the vertices
      };

      const response = await fetch(`${API_BASE_URL}/relationships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(edgeData)
      });

      if (response.ok) {
        this.stats.relationships.migrated++;
      } else if (response.status === 409) {
        this.stats.relationships.skipped++;
      } else {
        const error = await response.text();
        console.warn(`   ⚠️  Failed to migrate relationship ${sqliteDep.function_name} -> ${sqliteDep.depends_on_function_name}: ${error}`);
        this.stats.relationships.errors++;
      }
    } catch (error) {
      console.warn(`   ⚠️  Error migrating function dependency:`, error);
      this.stats.relationships.errors++;
    }
  }

  private async migrateFunctionModels(): Promise<void> {
    console.log('   🏗️  Migrating function-model relationships...');
    
    let query = `
      SELECT fm.*, 
             f.name as function_name,
             m.name as model_name
      FROM function_models fm
      JOIN functions f ON fm.function_id = f.id
      JOIN models m ON fm.model_id = m.id
    `;
    
    if (TEST_RELATIONSHIPS) {
      query += ' LIMIT 3';
    }
    
    const relationships = this.db.prepare(query).all();
    
    for (const rel of relationships) {
      await this.migrateFunctionModel(rel);
    }
    
    console.log(`      📦 ${relationships.length} function-model relationships processed`);
  }

  private async migrateFunctionModel(sqliteRel: any): Promise<void> {
    try {
      const fromVertex = this.migratedVertices.get(`function_${sqliteRel.function_id}`);
      const toVertex = this.migratedVertices.get(`model_${sqliteRel.model_id}`);
      
      if (!fromVertex || !toVertex) {
        console.warn(`   ⚠️  Skipping relationship: missing vertices for ${sqliteRel.function_name} -> ${sqliteRel.model_name}`);
        this.stats.relationships.errors++;
        return;
      }

      const edgeData = {
        fromVertexId: fromVertex.neptuneId,
        toVertexId: toVertex.neptuneId,
        type: 'USES',
        visibility: 'private', // Use private visibility to match the vertices
      };

      const response = await fetch(`${API_BASE_URL}/relationships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(edgeData)
      });

      if (response.ok) {
        this.stats.relationships.migrated++;
      } else if (response.status === 409) {
        this.stats.relationships.skipped++;
      } else {
        const error = await response.text();
        console.warn(`   ⚠️  Failed to migrate relationship ${sqliteRel.function_name} -> ${sqliteRel.model_name}: ${error}`);
        this.stats.relationships.errors++;
      }
    } catch (error) {
      console.warn(`   ⚠️  Error migrating function-model relationship:`, error);
      this.stats.relationships.errors++;
    }
  }

  private async migrateModelDependencies(): Promise<void> {
    console.log('   🔗 Migrating model dependencies...');
    
    let query = `
      SELECT md.*, 
             m1.name as model_name,
             m2.name as depends_on_model_name
      FROM model_dependencies md
      JOIN models m1 ON md.model_id = m1.id
      JOIN models m2 ON md.depends_on_model_id = m2.id
    `;
    
    if (TEST_RELATIONSHIPS) {
      query += ' LIMIT 3';
    }
    
    const dependencies = this.db.prepare(query).all();
    
    for (const dep of dependencies) {
      await this.migrateModelDependency(dep);
    }
    
    console.log(`      📦 ${dependencies.length} model dependencies processed`);
  }

  private async migrateModelDependency(sqliteDep: any): Promise<void> {
    try {
      const fromVertex = this.migratedVertices.get(`model_${sqliteDep.model_id}`);
      const toVertex = this.migratedVertices.get(`model_${sqliteDep.depends_on_model_id}`);
      
      if (!fromVertex || !toVertex) {
        console.warn(`   ⚠️  Skipping relationship: missing vertices for ${sqliteDep.model_name} -> ${sqliteDep.depends_on_model_name}`);
        this.stats.relationships.errors++;
        return;
      }

      const relationshipType = sqliteDep.dependency_type === 'extends' ? 'EXTENDS' : 'REFERENCES';
      
      const edgeData = {
        fromVertexId: fromVertex.neptuneId,
        toVertexId: toVertex.neptuneId,
        type: relationshipType,
        visibility: 'private', // Use private visibility to match the vertices
      };

      const response = await fetch(`${API_BASE_URL}/relationships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie,
        },
        body: JSON.stringify(edgeData)
      });

      if (response.ok) {
        this.stats.relationships.migrated++;
      } else if (response.status === 409) {
        this.stats.relationships.skipped++;
      } else {
        const error = await response.text();
        console.warn(`   ⚠️  Failed to migrate relationship ${sqliteDep.model_name} -> ${sqliteDep.depends_on_model_name}: ${error}`);
        this.stats.relationships.errors++;
      }
    } catch (error) {
      console.warn(`   ⚠️  Error migrating model dependency:`, error);
      this.stats.relationships.errors++;
    }
  }

  private async saveFailedItems(): Promise<void> {
    if (this.failedItems.length === 0 || !SAVE_FAILED_ITEMS) {
      return;
    }
    
    const failedItemsPath = join(__dirname, `migration-failed-items-${Date.now()}.json`);
    try {
      await writeFile(failedItemsPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        stats: this.stats,
        failedItems: this.failedItems
      }, null, 2));
      console.log(`\n💾 Failed items saved to: ${failedItemsPath}`);
      console.log('   You can retry these items by modifying the migration script to load from this file.');
    } catch (error) {
      console.error('⚠️  Failed to save failed items:', error);
    }
  }
  
  private async printFinalResults(): Promise<void> {
    console.log('\n✅ Migration Complete!');
    console.log('📊 Final Results:');
    console.log(`   Functions: ${this.stats.functions.migrated} migrated, ${this.stats.functions.skipped} skipped, ${this.stats.functions.errors} errors`);
    console.log(`   Models: ${this.stats.models.migrated} migrated, ${this.stats.models.skipped} skipped, ${this.stats.models.errors} errors`);
    console.log(`   Architecture: ${this.stats.architecture.migrated} migrated, ${this.stats.architecture.skipped} skipped, ${this.stats.architecture.errors} errors`);
    console.log(`   Code Patterns: ${this.stats.codePatterns.migrated} migrated, ${this.stats.codePatterns.skipped} skipped, ${this.stats.codePatterns.errors} errors`);
    console.log(`   Domain Knowledge: ${this.stats.domainKnowledge.migrated} migrated, ${this.stats.domainKnowledge.skipped} skipped, ${this.stats.domainKnowledge.errors} errors`);
    console.log(`   Relationships: ${this.stats.relationships.migrated} migrated, ${this.stats.relationships.skipped} skipped, ${this.stats.relationships.errors} errors`);
    
    const totalMigrated = this.stats.functions.migrated + this.stats.models.migrated + 
                         this.stats.architecture.migrated + this.stats.codePatterns.migrated + 
                         this.stats.domainKnowledge.migrated + this.stats.relationships.migrated;
    const totalErrors = this.stats.functions.errors + this.stats.models.errors + 
                       this.stats.architecture.errors + this.stats.codePatterns.errors + 
                       this.stats.domainKnowledge.errors + this.stats.relationships.errors;
    
    console.log(`\n🎯 Summary: ${totalMigrated} items migrated successfully`);
    if (totalErrors > 0) {
      console.log(`⚠️  ${totalErrors} items had errors and may need manual review`);
      await this.saveFailedItems();
    }
    console.log(`\n📈 Migrated ${this.migratedVertices.size} vertices with relationships`);
    console.log('\n💡 Next steps:');
    console.log('   1. Verify data in Neptune via /api/knowledge endpoints');
    console.log('   2. Test search functionality across migrated data');
    console.log('   3. Test relationship traversals via /api/relationships?op=traverse');
    console.log('   4. Verify graph structure with knowledge discovery queries');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  // Show usage if --help flag is provided
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('🚀 RMWM Context Database Migration to Neptune');
    console.log('');
    console.log('Usage:');
    console.log('  npm run migrate:rmwm                  # Full migration');
    console.log('  npm run migrate:rmwm --test           # Test mode: migrate only 1 of each vertex type');
    console.log('  npm run migrate:rmwm --test-relationships # Test relationship migration with sample data');
    console.log('  npm run migrate:rmwm --relationships-only # Only migrate relationships (uses existing vertices)');
    console.log('  npm run migrate:rmwm --no-save-failed # Don\'t save failed items to JSON');
    console.log('  npm run migrate:rmwm --help           # Show this help');
    console.log('');
    console.log('Test mode is recommended before running full migration to validate:');
    console.log('  - Claude Code integration works');
    console.log('  - API endpoints accept the data');
    console.log('  - Neptune schema handles the vertex types');
    console.log('  - Data transformation is correct');
    process.exit(0);
  }

  const migrator = new RMWMMigrator();
  
  try {
    await migrator.migrate();
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Migration interrupted by user');
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { RMWMMigrator };