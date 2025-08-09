import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { apiLoaderWithUserAuth } from "~/middleware/loaderWithUserAuth";
import { apiActionWithUserAuth } from "~/middleware/actionWithUserAuth";
import { parseRelationshipParams } from "~/handlers/utils/security";
import { getEdgesFrom, traverseGraph, createEdge } from "~/handlers/relationships";

/**
 * Relationships API endpoint - thin dispatcher for edge operations
 * All handlers use proper authentication and security context
 */

export const loader = apiLoaderWithUserAuth(
  async ({ request, context }: LoaderFunctionArgs<{ userId: string }>) => {
    const { operation } = parseRelationshipParams(request);
    
    // Map operations to handlers
    const handlers: Record<string, (request: Request, context: { userId: string }) => Promise<Response>> = {
      from: getEdgesFrom,
      traverse: traverseGraph,
    };
    
    const handler = handlers[operation];
    
    if (!handler) {
      // Check for unimplemented operations
      if (operation === "get") {
        return Response.json(
          { error: "Get edge by ID not yet implemented" },
          { status: 501 }
        );
      }
      if (operation === "to") {
        return Response.json(
          { error: "Find edges to vertex not yet implemented" },
          { status: 501 }
        );
      }
      
      return Response.json(
        {
          error: `Unknown operation: ${operation}. Supported: ${Object.keys(handlers).join(", ")}`,
        },
        { status: 400 }
      );
    }
    
    return handler(request, context);
  }
);

export const action = apiActionWithUserAuth(
  async ({ request, context }: ActionFunctionArgs<{ userId: string }>) => {
    const method = request.method;
    
    // Map HTTP methods to handlers
    const handlers: Record<string, (request: Request, context: { userId: string }) => Promise<Response>> = {
      POST: createEdge,
    };
    
    const handler = handlers[method];
    
    if (!handler) {
      // Check for unimplemented methods
      if (method === "DELETE") {
        return Response.json(
          { error: "Edge deletion not yet implemented" },
          { status: 501 }
        );
      }
      
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