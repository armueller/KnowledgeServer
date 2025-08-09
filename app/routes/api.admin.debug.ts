import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { cleanupVertices, cleanupTestData } from "~/handlers/admin/cleanup";
import { debugVertices, debugVisibility } from "~/handlers/admin/debug";
import { healthCheck, databaseStats } from "~/handlers/admin/health";

/**
 * Admin debug endpoint - consolidates all debug and admin utilities
 * CAUTION: These endpoints bypass normal security for emergency/debug purposes
 * 
 * GET operations (loader):
 * - ?action=health - Health check
 * - ?action=stats - Database statistics
 * - ?action=debug - Debug vertices
 * - ?action=visibility - Debug visibility breakdown
 * 
 * POST operations (action):
 * - ?action=cleanup - Remove wrong visibility vertices
 * - ?action=cleanup-test - Remove test tenant data
 */

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const handlers: Record<string, (request: Request) => Promise<Response>> = {
    health: healthCheck,
    stats: databaseStats,
    debug: debugVertices,
    visibility: debugVisibility,
  };

  const handler = handlers[action || "health"];
  
  if (!handler) {
    return Response.json(
      {
        error: "Invalid action. Supported GET actions: " + Object.keys(handlers).join(", "),
      },
      { status: 400 }
    );
  }

  return handler(request);
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const actionType = url.searchParams.get("action");

  const handlers: Record<string, (request: Request) => Promise<Response>> = {
    cleanup: cleanupVertices,
    "cleanup-test": cleanupTestData,
  };

  const handler = handlers[actionType || ""];
  
  if (!handler) {
    return Response.json(
      {
        error: "Invalid action. Supported POST actions: " + Object.keys(handlers).join(", "),
      },
      { status: 400 }
    );
  }

  // TODO: Add admin authentication check here
  // For now, log the action for audit purposes
  console.warn(`ADMIN ACTION: ${actionType} executed at ${new Date().toISOString()}`);

  return handler(request);
}