import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { apiLoaderWithUserAuth } from "~/middleware/loaderWithUserAuth";
import { apiActionWithUserAuth } from "~/middleware/actionWithUserAuth";
import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import type { 
  SecurityContext, 
  KnowledgeEdge,
  BelongsToEdge 
} from "~/models/neptune/types";

// Helper function to create security context from authenticated user
const createSecurityContext = (userId: string): SecurityContext => ({
  tenantId: "default-tenant", // TODO: Get from user profile
  userId,
  teamIds: ["default-team"], // TODO: Get from user profile  
  accessLevels: ["read", "write"],
  isAdmin: false, // TODO: Get from user profile
});

export const loader = apiLoaderWithUserAuth(async ({ request, context }: LoaderFunctionArgs & { context: { userId: string } }) => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  // Extract query parameters
  const operation = searchParams.get("op") || "list";
  const fromVertexId = searchParams.get("from");
  const toVertexId = searchParams.get("to");
  const edgeType = searchParams.get("type");
  const edgeId = searchParams.get("id");

  const securityContext = createSecurityContext(context.userId);
  const repo = new KnowledgeGraphRepository(securityContext);

  try {
    switch (operation) {
      case "get":
        // TODO: Implement get edge by ID once needed
        return Response.json({ error: "Get edge by ID not yet implemented" }, { status: 501 });

      case "from":
        if (!fromVertexId) {
          return Response.json({ error: "fromVertexId required for 'from' operation" }, { status: 400 });
        }
        
        const edgesFrom = await repo.edges.findEdgesFrom(fromVertexId, edgeType || undefined);
        return Response.json({
          success: true,
          data: edgesFrom,
          fromVertexId,
          edgeType: edgeType || "all",
          total: edgesFrom.length,
        });

      case "to":
        // TODO: Implement findEdgesTo if needed
        return Response.json({ error: "Find edges to vertex not yet implemented" }, { status: 501 });

      case "traverse":
        if (!fromVertexId) {
          return Response.json({ error: "fromVertexId required for 'traverse' operation" }, { status: 400 });
        }
        
        const depth = parseInt(searchParams.get("depth") || "2");
        const edgeTypes = searchParams.get("edgeTypes")?.split(",").map(t => t.trim());
        
        const paths = await repo.traverseGraph(fromVertexId, depth, edgeTypes);
        return Response.json({
          success: true,
          data: paths,
          fromVertexId,
          depth,
          edgeTypes: edgeTypes || ["all"],
          total: paths.length,
        });

      default:
        return Response.json({
          error: `Unknown operation: ${operation}. Use: from, to, traverse`,
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Relationships API error:", error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
});

export const action = apiActionWithUserAuth(async ({ request, context }: ActionFunctionArgs & { context: { userId: string } }) => {
  const securityContext = createSecurityContext(context.userId);
  const repo = new KnowledgeGraphRepository(securityContext);

  try {
    if (request.method === "POST") {
      const data = await request.json();
      
      // Validate required fields
      if (!data.fromVertexId || !data.toVertexId || !data.type) {
        return Response.json({ 
          error: "fromVertexId, toVertexId, and type are required fields" 
        }, { status: 400 });
      }

      let newEdge: KnowledgeEdge;
      
      switch (data.type) {
        case "BELONGS_TO":
          newEdge = await repo.edges.createEdge<BelongsToEdge>(
            data.fromVertexId,
            data.toVertexId,
            {
              type: "BELONGS_TO",
              role: data.role || "member",
              responsibilities: data.responsibilities || [],
              visibility: data.visibility || "team",
            }
          );
          break;

        case "CALLS":
          newEdge = await repo.edges.createEdge<KnowledgeEdge>(
            data.fromVertexId,
            data.toVertexId,
            {
              type: "CALLS",
              visibility: data.visibility || "team",
            }
          );
          break;

        case "USES":
          newEdge = await repo.edges.createEdge<KnowledgeEdge>(
            data.fromVertexId,
            data.toVertexId,
            {
              type: "USES",
              visibility: data.visibility || "team",
            }
          );
          break;

        case "IMPLEMENTS":
          newEdge = await repo.edges.createEdge<KnowledgeEdge>(
            data.fromVertexId,
            data.toVertexId,
            {
              type: "IMPLEMENTS",
              visibility: data.visibility || "team",
            }
          );
          break;

        case "DEPENDS_ON":
          newEdge = await repo.edges.createEdge<KnowledgeEdge>(
            data.fromVertexId,
            data.toVertexId,
            {
              type: "DEPENDS_ON",
              visibility: data.visibility || "team",
            }
          );
          break;

        case "EXTENDS":
          newEdge = await repo.edges.createEdge<KnowledgeEdge>(
            data.fromVertexId,
            data.toVertexId,
            {
              type: "EXTENDS",
              visibility: data.visibility || "team",
            }
          );
          break;

        case "REFERENCES":
          newEdge = await repo.edges.createEdge<KnowledgeEdge>(
            data.fromVertexId,
            data.toVertexId,
            {
              type: "REFERENCES",
              visibility: data.visibility || "team",
            }
          );
          break;

        case "CONTAINS":
          newEdge = await repo.edges.createEdge<KnowledgeEdge>(
            data.fromVertexId,
            data.toVertexId,
            {
              type: "CONTAINS",
              visibility: data.visibility || "team",
            }
          );
          break;

        default:
          return Response.json({ error: `Unsupported edge type: ${data.type}` }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: "Relationship created successfully",
        data: newEdge,
      }, { status: 201 });
    }

    if (request.method === "DELETE") {
      // TODO: Implement edge deletion once needed
      return Response.json({ error: "Edge deletion not yet implemented" }, { status: 501 });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("Relationships API action error:", error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
});