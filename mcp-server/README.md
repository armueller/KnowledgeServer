# KnowledgeServer MCP Server

An MCP (Model Context Protocol) server that enables Claude to interact with the KnowledgeServer knowledge graph, providing access to code patterns, dependencies, and architectural insights.

## Overview

This MCP server acts as a bridge between Claude and your KnowledgeServer instance, enabling Claude to:
- Search for existing patterns and utilities
- Analyze dependencies and impact
- Create and update knowledge graph entries
- Follow established conventions (the "pit of success")

## Features

### 🔍 Search & Discovery (5 tools)
- `search_by_domain` - Find vertices by domain with optional project filtering
- `search_by_tag` - Search by tags across the knowledge graph
- `search_by_project` - List all vertices in a specific project
- `graph_traversal` - Traverse the graph from a starting vertex
- `list_vertices` - List vertices with type/domain/project filters

### 📊 Detail Retrieval (3 tools)
- `get_vertex` - Get comprehensive details about a specific vertex
- `get_edges` - Retrieve all relationships from a vertex
- `traverse_from_vertex` - Deep traversal with edge type filtering

### 🧪 Analysis (3 tools)
- `analyze_dependencies` - Forward/reverse dependency analysis with circular detection
- `analyze_impact` - Assess the impact of changes with severity ratings
- `detect_patterns` - Find patterns and anti-patterns (CRITICAL for conventions)

### ✏️ Knowledge Management (8 tools)
- `create_function` - Add new function vertices
- `create_model` - Add model/interface/type vertices
- `create_pattern` - Document patterns (CRITICAL for pit of success)
- `create_system` - Add system/service vertices
- `create_concept` - Add domain concepts
- `update_vertex` - Modify existing vertices
- `delete_vertex` - Remove vertices
- `create_edge` - Create relationships between vertices

## Installation

### Prerequisites
- Node.js 20+
- Access to a KnowledgeServer instance
- Claude Code or Claude Desktop

### Setup

1. **Install dependencies:**
```bash
cd mcp-server
npm install
```

2. **Build the server:**
```bash
npm run build
```

3. **Configure environment variables:**
Create a `.env` file in the mcp-server directory:
```env
KNOWLEDGE_API_URL=https://your-knowledge-server.com/api
KNOWLEDGE_USERNAME=your-email@example.com
KNOWLEDGE_PASSWORD=your-password
LOG_LEVEL=info
```

## Configuration

### For Claude Code (Project-level)

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "knowledge-server": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "KNOWLEDGE_API_URL": "https://your-server.com/api",
        "KNOWLEDGE_USERNAME": "email@example.com",
        "KNOWLEDGE_PASSWORD": "your-password",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### For Claude Code (User-level)

Run in Claude Code:
```
claude mcp add knowledge-server --scope user /path/to/mcp-server/dist/index.js
```

### For Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "knowledge-server": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "KNOWLEDGE_API_URL": "https://your-server.com/api",
        "KNOWLEDGE_USERNAME": "email@example.com",
        "KNOWLEDGE_PASSWORD": "your-password"
      }
    }
  }
}
```

## Usage Examples

### Search for Patterns
```
"What authentication patterns are used in this project?"
"Show me all API endpoint patterns"
"Find form validation patterns"
```

### Discover Utilities
```
"Is there a function for email validation?"
"What database helpers are available?"
"Show me all functions in the auth domain"
```

### Analyze Dependencies
```
"What depends on the getUserById function?"
"Show me the dependency chain for the payment module"
"Find circular dependencies in the data layer"
```

### Impact Analysis
```
"What would break if I change the User model?"
"Analyze the impact of deleting the legacy auth module"
"What's affected by modifying the API response format?"
```

### Create Knowledge
```
"Document this new validation function"
"Create a pattern entry for the repository pattern we're using"
"Add this new React component to the knowledge graph"
```

## Development

### Running in Development
```bash
npm run dev
```

### Testing with Inspector
```bash
npm run inspect
```

### Running Tests
```bash
npm test
```

### Type Checking
```bash
npx tsc --noEmit
```

## Architecture

### Directory Structure
```
mcp-server/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── config.ts           # Configuration management
│   ├── tools/              # Tool implementations
│   │   ├── search.ts       # Search & discovery tools
│   │   ├── details.ts      # Detail retrieval tools
│   │   ├── analysis.ts     # Analysis tools
│   │   ├── management.ts   # CRUD operations
│   │   ├── pathfinding.ts  # Path & connection tools (TODO)
│   │   ├── bulk.ts         # Bulk operations (TODO)
│   │   └── project.ts      # Project management (TODO)
│   ├── utils/
│   │   ├── api-client.ts   # KnowledgeServer API client
│   │   ├── cache.ts        # LRU cache implementation
│   │   └── logger.ts       # Logging utility
│   └── types/
│       └── tools.ts        # TypeScript types and Zod schemas
├── dist/                   # Compiled JavaScript (git-ignored)
├── package.json
├── tsconfig.json
└── README.md
```

### Key Components

#### API Client
Handles authentication and communication with KnowledgeServer API:
- Session management with auto-refresh
- Retry logic with exponential backoff
- Request/response type safety

#### Cache Manager
LRU cache for performance optimization:
- 5-minute TTL for search results
- 10-minute TTL for vertex details
- Intelligent cache invalidation on updates

#### Tool Handlers
Each tool category has its own module:
- Input validation with Zod schemas
- Error handling and logging
- Response formatting for Claude

## Configuration Options

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `KNOWLEDGE_API_URL` | KnowledgeServer API endpoint | Required |
| `KNOWLEDGE_USERNAME` | Authentication username | Required |
| `KNOWLEDGE_PASSWORD` | Authentication password | Required |
| `LOG_LEVEL` | Logging verbosity (debug/info/warn/error) | info |
| `CACHE_TTL` | Cache time-to-live in seconds | 300 |
| `CACHE_MAX_SIZE` | Maximum cache entries | 100 |
| `MAX_RESULTS` | Maximum results per query | 50 |
| `REQUEST_TIMEOUT` | API timeout in milliseconds | 30000 |
| `RETRY_ATTEMPTS` | Number of retry attempts | 3 |

## Troubleshooting

### Server won't start
- Check credentials in environment variables
- Verify KnowledgeServer API is accessible
- Check Node.js version (requires 20+)

### Tools not appearing in Claude
- Ensure server is in "connected" state (check with `/mcp`)
- Rebuild server after changes: `npm run build`
- Check for TypeScript errors: `npx tsc --noEmit`

### Authentication failures
- Verify username/password are correct
- Check if API URL includes `/api` suffix
- Ensure user has appropriate permissions

### Cache issues
- Clear cache by restarting server
- Adjust `CACHE_TTL` for different cache duration
- Monitor cache hit rate in logs

## Philosophy: The Pit of Success

This MCP server embodies the "pit of success" philosophy - making it easier for Claude to write correct, pattern-compliant code than to deviate from established conventions. By providing immediate access to:

- **Established patterns** - How things are done in this codebase
- **Existing utilities** - What's already available vs. what needs creation
- **Architecture conventions** - Accepted ways to structure code
- **Impact awareness** - Understanding consequences before making changes

The goal is to eliminate the iteration cycle of "write → discover issues → rewrite" and instead enable "understand → write correctly first time."

## Contributing

### Adding New Tools

1. Define the schema in `src/types/tools.ts`
2. Implement the handler in the appropriate tool file
3. Export from the tool module
4. Import in `src/index.ts`
5. Rebuild and test

### Testing Changes

1. Run type checking: `npx tsc --noEmit`
2. Test with inspector: `npm run inspect`
3. Verify in Claude Code with `/mcp` command

## License

MIT

## Support

For issues or questions:
- Check the [MCP_SERVER_PLAN.md](../MCP_SERVER_PLAN.md) for design decisions
- Review [MCP_USE_CASES.md](./MCP_USE_CASES.md) for usage patterns
- Open an issue in the KnowledgeServer repository