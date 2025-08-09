import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parseRelationshipParams } from "../utils/security";

/**
 * Traverse the graph from a starting vertex
 */
export async function traverseGraph(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const { fromVertexId, depth, edgeTypes } = parseRelationshipParams(request);
  
  if (!fromVertexId) {
    return Response.json(
      { error: "fromVertexId required for 'traverse' operation" },
      { status: 400 }
    );
  }
  
  try {
    const securityContext = await buildSecurityContext(context.userId);
    const repo = new KnowledgeGraphRepository(securityContext);
    
    const paths = await repo.traverseGraph(fromVertexId, depth, edgeTypes);
    
    return Response.json({
      success: true,
      data: paths,
      fromVertexId,
      depth,
      edgeTypes: edgeTypes || ["all"],
      total: paths.length,
    });
    
  } catch (error) {
    console.error("Graph traversal error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}