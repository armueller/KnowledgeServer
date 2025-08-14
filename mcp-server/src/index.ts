#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { config } from './config.js';
import { logger } from './utils/logger.js';
import { apiClient } from './utils/api-client.js';

// Import existing tool handlers
import { searchTools } from './tools/search.js';
import { detailTools } from './tools/details.js';
import { analysisTools } from './tools/analysis.js';
import { managementTools } from './tools/management.js';
import { pathfindingTools } from './tools/pathfinding.js';

// TODO: Import these as they are implemented
// import { bulkTools } from './tools/bulk.js';
// import { projectTools } from './tools/project.js';

// Define the type for a tool
interface ToolDefinition {
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (params: any) => Promise<any>;
}

// Combine all available tools
const allTools: Record<string, ToolDefinition> = {
  ...searchTools,
  ...detailTools,
  ...analysisTools,
  ...managementTools,
  ...pathfindingTools,
  // TODO: Add these as they are implemented
  // ...bulkTools,
  // ...projectTools,
};

// Create MCP server
const server = new Server(
  {
    name: 'knowledge-server-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Error handling wrapper
async function handleToolCall(name: string, args: any) {
  try {
    const tool = allTools[name];
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Validate input
    const validatedArgs = tool.inputSchema.parse(args);
    
    // Execute tool handler
    const result = await tool.handler(validatedArgs);
    
    // Format response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error(`Tool ${name} failed:`, error);
    
    // Return user-friendly error
    let errorMessage = 'An error occurred while executing the tool.';
    
    if (error instanceof z.ZodError) {
      errorMessage = `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: errorMessage,
            tool: name,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = Object.entries(allTools).map(([name, tool]) => {
    // Convert Zod schema to JSON Schema
    const jsonSchema = zodToJsonSchema(tool.inputSchema, {
      target: 'openApi3',
      $refStrategy: 'none',
    });
    
    return {
      name,
      description: tool.description,
      inputSchema: jsonSchema as any,
    };
  });

  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return handleToolCall(request.params.name, request.params.arguments || {});
});

// Initialize server
async function main() {
  try {
    logger.info('Starting KnowledgeServer MCP server...');
    logger.info(`Version: 1.0.0`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Pre-authenticate to verify credentials
    logger.info('Authenticating with KnowledgeServer API...');
    await apiClient.authenticate();
    logger.info('Successfully authenticated');
    
    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('KnowledgeServer MCP server is running');
    logger.info(`Connected to API: ${config.api.url}`);
    logger.info(`Cache TTL: ${config.cache.ttl}s`);
    logger.info(`Available tools: ${Object.keys(allTools).length}`);
    logger.info(`Tools: ${Object.keys(allTools).join(', ')}`);
    
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down MCP server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});