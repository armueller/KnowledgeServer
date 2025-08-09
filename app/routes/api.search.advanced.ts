import type { LoaderFunctionArgs } from "react-router";
import { apiLoaderWithUserAuth } from "~/middleware/loaderWithUserAuth";
import {
  domainSearch,
  tagSearch,
  projectSearch,
  graphTraversal,
  functionDependencies,
} from "~/handlers/search";

/**
 * Advanced search API endpoint - thin dispatcher with authentication
 * Middleware validates session ONCE, then passes userId to handlers
 */
export const loader = apiLoaderWithUserAuth(
  async ({ request, context }: LoaderFunctionArgs<{ userId: string }>) => {
    const url = new URL(request.url);
    const searchType = url.searchParams.get("type");

    // Map search types to handlers - now with context parameter
    const handlers: Record<string, (request: Request, context: { userId: string }) => Promise<Response>> = {
      domain: domainSearch,
      tag: tagSearch,
      project: projectSearch,
      traversal: graphTraversal,
      function_dependencies: functionDependencies,
    };

    // Dispatch to appropriate handler with context
    const handler = handlers[searchType || ""];
    
    if (!handler) {
      return Response.json(
        {
          error: "Invalid search type. Supported types: " + Object.keys(handlers).join(", "),
        },
        { status: 400 }
      );
    }

    // Pass both request and context to handler
    return handler(request, context);
  }
);