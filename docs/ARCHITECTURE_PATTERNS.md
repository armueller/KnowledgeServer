# KnowledgeServer Architecture Patterns

## API Route Organization Pattern (Flat File Routing)

### Context
React Router v7 uses flat file routing where the file structure in `/routes` directly maps to URL paths. We cannot use subdirectories to organize routes, but we need to keep our API endpoints maintainable and follow separation of concerns.

### Pattern: Thin Routes + Handlers + Services

#### Structure
```
app/
├── routes/                              # Flat routing (React Router v7)
│   ├── api.search.advanced.ts          # Thin dispatcher
│   ├── api.knowledge.ts                # Thin dispatcher  
│   └── api.relationships.ts            # Thin dispatcher
│
├── handlers/                            # Request handlers (business logic)
│   ├── search/
│   │   ├── domainSearch.ts            # Single responsibility
│   │   ├── tagSearch.ts               # Focused handlers
│   │   └── index.ts                   # Exports
│   ├── knowledge/
│   │   ├── getKnowledge.ts            # CRUD operations
│   │   ├── listKnowledge.ts           # Separated by action
│   │   ├── createKnowledge.ts
│   │   ├── updateKnowledge.ts
│   │   └── deleteKnowledge.ts
│   └── utils/
│       ├── auth.ts                    # Authentication utilities
│       └── security.ts                # Parameter parsing
│
├── services/                           # Data access layer
│   └── neptune/
│       └── repository.ts              # Database operations
│
└── middleware/
    ├── loaderWithUserAuth.ts          # GET authentication
    └── actionWithUserAuth.ts          # POST/PUT/DELETE authentication
```

#### Key Principles

1. **Thin Routes (Dispatchers)**
   - Route files are ~50-75 lines max
   - Only responsible for request dispatch
   - No business logic
   - Use authentication middleware

2. **Focused Handlers**
   - Single responsibility per handler
   - Receive `(request, context)` parameters
   - Build security context from validated userId
   - Return Response objects

3. **Authentication Flow**
   - Middleware validates session ONCE at route level
   - Passes validated userId in context
   - Handlers use `buildSecurityContext(context.userId)`
   - NO re-validation of session in handlers

### Implementation Examples

#### Thin Route (Dispatcher)
```typescript
// api.search.advanced.ts
import { apiLoaderWithUserAuth } from "~/middleware/loaderWithUserAuth";
import { domainSearch, tagSearch, projectSearch } from "~/handlers/search";

export const loader = apiLoaderWithUserAuth(
  async ({ request, context }: LoaderFunctionArgs<{ userId: string }>) => {
    const url = new URL(request.url);
    const searchType = url.searchParams.get("type");

    const handlers = {
      domain: domainSearch,
      tag: tagSearch,
      project: projectSearch,
    };

    const handler = handlers[searchType || ""];
    if (!handler) {
      return Response.json({ error: "Invalid search type" }, { status: 400 });
    }

    return handler(request, context);
  }
);
```

#### Handler with Proper Authentication
```typescript
// handlers/search/domainSearch.ts
import { buildSecurityContext } from "../utils/auth";
import { parseSearchParams } from "../utils/security";

export async function domainSearch(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const { domain, limit, offset } = parseSearchParams(request);
  
  if (!domain) {
    return Response.json({ error: "Domain required" }, { status: 400 });
  }
  
  try {
    // Build security context from validated userId (no re-validation!)
    const securityContext = await buildSecurityContext(context.userId);
    const repository = new KnowledgeGraphRepository(securityContext);
    
    const results = await repository.vertices.query({
      securityContext,
      vertexFilters: { domain },
      limit,
      offset,
    });
    
    return Response.json({ success: true, results: results.data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

#### Shared Utilities
```typescript
// handlers/utils/auth.ts
export async function buildSecurityContext(userId: string): Promise<SecurityContext> {
  // TODO: Load user's tenant and team information from database
  return {
    tenantId: "default-tenant",
    userId,
    teamIds: [],
    accessLevels: ["write"],
    isAdmin: false,
  };
}

// handlers/utils/security.ts
export function parseSearchParams(request: Request) {
  const url = new URL(request.url);
  return {
    domain: url.searchParams.get("domain"),
    tag: url.searchParams.get("tag"),
    project: url.searchParams.get("project"),
    limit: parseInt(url.searchParams.get("limit") || "50"),
    offset: parseInt(url.searchParams.get("offset") || "0"),
    orderBy: url.searchParams.get("orderBy") || "name",
    orderDirection: url.searchParams.get("orderDirection") as "ASC" | "DESC" || "ASC",
  };
}
```

### Benefits

1. **Maintainability**
   - Easy to find and modify specific functionality
   - Clear separation of concerns
   - Consistent patterns across all APIs

2. **Performance**
   - Session validated once per request
   - No redundant database queries
   - Efficient security context building

3. **Testability**
   - Handlers can be unit tested independently
   - Mock context easily for testing
   - Services isolated from HTTP layer

4. **Security**
   - Centralized authentication
   - Consistent security context
   - No authentication bypass risks

### Anti-Patterns to Avoid

❌ **DON'T: Re-validate session in handlers**
```typescript
// BAD - Session already validated by middleware!
async function handler(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = await getUserIdFromAccessToken(session.get("accessToken"));
  // ...
}
```

❌ **DON'T: Put business logic in routes**
```typescript
// BAD - Route files should only dispatch
export const loader = async ({ request }) => {
  // 200+ lines of business logic...
}
```

❌ **DON'T: Create duplicate utilities**
```typescript
// BAD - Use shared utilities instead
const createSecurityContext = (userId: string) => ({ ... });
```

✅ **DO: Use the established pattern**
- Middleware → Thin Route → Handler → Service
- Validate once, use context everywhere
- Share utilities across handlers

### Migration Guide

When refactoring an existing monolithic route:

1. **Identify operations** - List all operations the route handles
2. **Create handlers** - One handler per operation
3. **Extract utilities** - Move shared logic to utils
4. **Update route** - Convert to thin dispatcher
5. **Add authentication** - Wrap with appropriate middleware
6. **Test** - Verify authentication and functionality

### Related Patterns

- **Authentication Middleware Pattern** - How we handle auth
- **Repository Pattern** - Database access abstraction
- **Security Context Pattern** - Multi-tenant data isolation