import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parseRelationshipParams } from "../utils/security";

/**
 * Get all edges from a specific vertex
 */
export async function getEdgesFrom(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const { fromVertexId, edgeType } = parseRelationshipParams(request);
  
  if (!fromVertexId) {
    return Response.json(
      { error: "fromVertexId required for 'from' operation" },
      { status: 400 }
    );
  }
  
  try {
    const securityContext = await buildSecurityContext(context.userId);
    const repo = new KnowledgeGraphRepository(securityContext);
    
    const edgesFrom = await repo.edges.findEdgesFrom(
      fromVertexId,
      edgeType || undefined
    );
    
    return Response.json({
      success: true,
      data: edgesFrom,
      fromVertexId,
      edgeType: edgeType || "all",
      total: edgesFrom.length,
    });
    
  } catch (error) {
    console.error("Get edges from error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}