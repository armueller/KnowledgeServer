import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { apiLoaderWithUserAuth } from "~/middleware/loaderWithUserAuth";
import { apiActionWithUserAuth } from "~/middleware/actionWithUserAuth";
import {
  getKnowledge,
  listKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
} from "~/handlers/knowledge";

/**
 * Knowledge API endpoint - thin dispatcher for CRUD operations
 * All handlers use proper authentication and security context
 */

// GET operations
export const loader = apiLoaderWithUserAuth(
  async ({ request, context }: LoaderFunctionArgs<{ userId: string }>) => {
    const url = new URL(request.url);
    const operation = url.searchParams.get("op") || "list";
    const id = url.searchParams.get("id");
    
    // If ID is provided without operation, assume get
    if (id && operation === "list") {
      return getKnowledge(request, context);
    }
    
    // Map operations to handlers
    const handlers: Record<string, (request: Request, context: { userId: string }) => Promise<Response>> = {
      get: getKnowledge,
      list: listKnowledge,
    };
    
    const handler = handlers[operation];
    
    if (!handler) {
      return Response.json(
        {
          error: `Invalid operation: ${operation}. Supported: ${Object.keys(handlers).join(", ")}`,
        },
        { status: 400 }
      );
    }
    
    return handler(request, context);
  }
);

// POST/PUT/DELETE operations
export const action = apiActionWithUserAuth(
  async ({ request, context }: ActionFunctionArgs<{ userId: string }>) => {
    const method = request.method;
    
    // Map HTTP methods to handlers
    const handlers: Record<string, (request: Request, context: { userId: string }) => Promise<Response>> = {
      POST: createKnowledge,
      PUT: updateKnowledge,
      PATCH: updateKnowledge,
      DELETE: deleteKnowledge,
    };
    
    const handler = handlers[method];
    
    if (!handler) {
      return Response.json(
        {
          error: `Method not allowed: ${method}`,
        },
        { status: 405 }
      );
    }
    
    return handler(request, context);
  }
);