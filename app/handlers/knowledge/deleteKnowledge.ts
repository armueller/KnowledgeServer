import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";

/**
 * Handle deleting knowledge entries
 */
export async function deleteKnowledge(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  
  if (!id) {
    return Response.json(
      { error: "ID parameter required for delete" },
      { status: 400 }
    );
  }
  
  try {
    const securityContext = await buildSecurityContext(context.userId);
    const repo = new KnowledgeGraphRepository(securityContext);
    
    const success = await repo.vertices.deleteVertex(id);
    
    if (!success) {
      return Response.json(
        { error: "Failed to delete knowledge entry or insufficient permissions" },
        { status: 403 }
      );
    }
    
    return Response.json({
      success: true,
      message: "Knowledge entry deleted successfully",
    });
    
  } catch (error) {
    console.error("Delete knowledge error:", error);
    
    // Check for permission errors
    if (error instanceof Error && error.message.includes("Insufficient permissions")) {
      return Response.json(
        {
          success: false,
          error: "Insufficient permissions to delete this entry",
        },
        { status: 403 }
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