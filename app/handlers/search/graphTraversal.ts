import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parseTraversalParams } from "../utils/security";

/**
 * Handle graph traversal requests
 * Context contains validated userId from middleware
 */
export async function graphTraversal(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const { startId, depth, edgeTypes, limit } = parseTraversalParams(request);
  
  if (!startId) {
    return Response.json(
      { error: "StartId parameter required for traversal" },
      { status: 400 }
    );
  }
  
  try {
    // Build security context from validated userId (no re-validation!)
    const securityContext = await buildSecurityContext(context.userId);
    const repository = new KnowledgeGraphRepository(securityContext);
    
    const results = await repository.traverseGraph(startId, depth, edgeTypes);
    
    // Limit results if specified
    const limitedResults = limit ? results.slice(0, limit) : results;
    
    return Response.json({
      success: true,
      type: "graph_traversal",
      query: { startId, depth, edgeTypes, limit },
      results: limitedResults,
      pathCount: limitedResults.length,
      totalPaths: results.length,
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