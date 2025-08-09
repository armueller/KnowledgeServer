import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import type { KnowledgeEdge, BelongsToEdge } from "~/models/neptune/types";

/**
 * Create a new edge between two vertices
 */
export async function createEdge(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.fromVertexId || !data.toVertexId || !data.type) {
      return Response.json(
        { error: "fromVertexId, toVertexId, and type are required fields" },
        { status: 400 }
      );
    }
    
    if (!data.visibility) {
      return Response.json(
        { error: "visibility is required" },
        { status: 400 }
      );
    }
    
    const securityContext = await buildSecurityContext(context.userId);
    const repo = new KnowledgeGraphRepository(securityContext);
    
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
            visibility: data.visibility,
            userId: context.userId,
          }
        );
        break;
        
      case "CALLS":
      case "USES":
      case "IMPLEMENTS":
      case "DEPENDS_ON":
      case "EXTENDS":
      case "REFERENCES":
      case "CONTAINS":
        newEdge = await repo.edges.createEdge<KnowledgeEdge>(
          data.fromVertexId,
          data.toVertexId,
          {
            type: data.type,
            visibility: data.visibility,
            userId: context.userId,
          }
        );
        break;
        
      default:
        return Response.json(
          { error: `Unsupported edge type: ${data.type}` },
          { status: 400 }
        );
    }
    
    return Response.json(
      {
        success: true,
        message: "Relationship created successfully",
        data: newEdge,
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error("Create edge error:", error);
    
    // Check for permission errors
    if (error instanceof Error && error.message.includes("Insufficient permissions")) {
      return Response.json(
        {
          success: false,
          error: "Insufficient permissions to create this relationship",
        },
        { status: 403 }
      );
    }
    
    // Check for vertex not found errors
    if (error instanceof Error && 
        (error.message.includes("not found") || 
         error.message.includes("does not exist") ||
         error.message.includes("No vertex with id"))) {
      return Response.json(
        {
          success: false,
          error: "One or both vertices not found",
        },
        { status: 404 }
      );
    }
    
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}