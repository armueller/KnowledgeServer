import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  // Simple health check - just verify the application is running
  // Don't check external dependencies to avoid deployment issues
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      app: "ok",
      neptune: "not_checked",  // Will implement detailed checks later
      mcp: "not_checked",      // Will implement detailed checks later
    },
  };

  return Response.json(health, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}