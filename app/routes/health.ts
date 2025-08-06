import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  // TODO: Add Neo4j health check
  // TODO: Add MCP server health check
  
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      neo4j: "ok", // TODO: Implement actual check
      mcp: "ok",   // TODO: Implement actual check
    },
  };

  return Response.json(health, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}