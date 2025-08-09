import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";

/**
 * Handle GET requests for individual knowledge entries
 */
export async function getKnowledge(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  
  if (!id) {
    return Response.json(
      { error: "ID parameter required" },
      { status: 400 }
    );
  }
  
  try {
    const securityContext = await buildSecurityContext(context.userId);
    const repo = new KnowledgeGraphRepository(securityContext);
    
    const vertex = await repo.vertices.findById(id);
    
    if (!vertex) {
      return Response.json(
        { error: "Knowledge entry not found" },
        { status: 404 }
      );
    }
    
    return Response.json({
      success: true,
      data: vertex,
    });
  } catch (error) {
    console.error("Get knowledge error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}