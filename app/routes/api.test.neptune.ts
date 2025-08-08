import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import type { SecurityContext, FunctionVertex, SystemVertex, BelongsToEdge } from "~/models/neptune/types";

// Test endpoint for Neptune operations and serializer debugging
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const operation = url.searchParams.get("op") || "status";
  
  // Mock security context for testing
  const securityContext: SecurityContext = {
    tenantId: "test-tenant-001",
    userId: "test-user-001",
    teamIds: ["team-001"],
    accessLevels: ["read", "write"],
    isAdmin: true,
  };
  
  const repo = new KnowledgeGraphRepository(securityContext);
  
  try {
    switch (operation) {
      case "status":
        return Response.json({
          status: "ready",
          message: "Neptune test endpoint ready. Use ?op=create, ?op=create-edge, ?op=clean",
        });

      case "create":
        // Create test vertices using SystemVertex and FunctionVertex
        const system: SystemVertex = await repo.vertices.createVertex({
          type: "System",
          name: "Test Knowledge Server",
          description: "A test system for Neptune integration",
          project: "knowledge-server",
          domain: "testing", 
          visibility: "organization",
          accessLevel: "admin",
          tags: ["test", "neptune"],
          keywords: ["graph", "database"],
          status: "experimental",
          confidence: 0.8,
          version: "1.0.0",
          schemaVersion: "1.0.0",
          userId: securityContext.userId,
          systemDomain: "testing",
          boundaries: ["self-contained testing system"],
          interfaces: ["HTTP API", "WebSocket"],
          contracts: ["REST API v1"],
        });
        
        const func: FunctionVertex = await repo.vertices.createVertex({
          type: "Function",
          name: "testNeptuneConnection",
          description: "Function to test Neptune connectivity",
          project: "knowledge-server",
          domain: "testing",
          signature: "async function testNeptuneConnection(): Promise<boolean>",
          visibility: "team", 
          accessLevel: "admin",
          tags: ["test", "connection"],
          keywords: ["neptune", "test"],
          status: "experimental",
          confidence: 0.9,
          version: "1.0.0",
          schemaVersion: "1.0.0",
          userId: securityContext.userId,
          filePath: "test.ts",
          lineStart: 42,
          lineEnd: 45,
          parameters: ["none"],
          returnType: "Promise<boolean>",
          sideEffects: ["network_call"],
          isAsync: true,
          isPure: false,
        });
        
        return Response.json({
          status: "success", 
          message: "Created test vertices successfully",
          data: {
            system,
            function: func,
          },
        });

      case "create-edge":
        try {
          // Create edge between existing vertices
          const existingSystems = await repo.vertices.query({
            securityContext,
            vertexFilters: {
              type: "System",
            },
            limit: 1,
          });
          
          const existingFunctions = await repo.vertices.query({
            securityContext,
            vertexFilters: {
              type: "Function",
            },
            limit: 1,
          });
          
          if (existingSystems.data.length === 0 || existingFunctions.data.length === 0) {
            return Response.json({
              status: "error",
              message: "Need both a system and function vertex. Run ?op=create first.",
              debug: {
                systemsCount: existingSystems.data.length,
                functionsCount: existingFunctions.data.length,
              }
            }, { status: 400 });
          }
          
          const edge: BelongsToEdge = await repo.edges.createEdge(
            existingFunctions.data[0].id,
            existingSystems.data[0].id,
            {
              type: "BELONGS_TO",
              visibility: "team",
              userId: securityContext.userId,
              role: "implementation",
              responsibilities: ["testing Neptune connectivity"],
            }
          );
          
          return Response.json({
            status: "success",
            message: "Created edge between vertices",
            data: {
              edge,
              from: existingFunctions.data[0],
              to: existingSystems.data[0],
            },
          });
        } catch (edgeError) {
          return Response.json({
            status: "error",
            message: "Edge creation failed",
            error: edgeError instanceof Error ? edgeError.message : String(edgeError),
            stack: edgeError instanceof Error ? edgeError.stack : undefined,
          }, { status: 500 });
        }

      case "clean":
        // Raw cleanup bypassing security for testing
        const { getGraphTraversalSource: getGraphTraversalSourceForClean } = await import("~/services/neptune/connection");
        const gWriteClean = getGraphTraversalSourceForClean();
        
        try {
          // Delete test vertices directly without security checks
          await gWriteClean.V()
            .has('tenantId', 'test-tenant-001')
            .drop()
            .iterate();
          
          return Response.json({
            status: "success",
            message: "Cleaned up test data (bypassed security for testing)",
          });
        } catch (cleanupError) {
          return Response.json({
            status: "error",
            message: "Cleanup failed",
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        }
        
      default:
        return Response.json({
          status: "error",
          message: `Unknown operation: ${operation}`,
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Neptune test error:", error);
    return Response.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

// Support POST for creating test data
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const operation = formData.get("operation") as string;
  
  // Reuse the loader logic
  const url = new URL(request.url);
  url.searchParams.set("op", operation);
  
  const newRequest = new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  });
  
  return loader({ request: newRequest, params: {}, context: {} });
}