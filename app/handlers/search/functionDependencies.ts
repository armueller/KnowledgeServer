import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";

/**
 * Handle function dependency queries
 * Context contains validated userId from middleware
 */
export async function functionDependencies(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const url = new URL(request.url);
  const functionId = url.searchParams.get("functionId");
  
  if (!functionId) {
    return Response.json(
      { error: "FunctionId parameter required" },
      { status: 400 }
    );
  }
  
  try {
    // Build security context from validated userId (no re-validation!)
    const securityContext = await buildSecurityContext(context.userId);
    const repository = new KnowledgeGraphRepository(securityContext);
    
    // Get outgoing edges (functions this function calls)
    const outgoingEdges = await repository.edges.findEdgesFrom(functionId, "CALLS");
    
    // Get the function details
    const functionVertex = await repository.vertices.findById(functionId);
    
    if (!functionVertex) {
      return Response.json(
        { error: "Function not found" },
        { status: 404 }
      );
    }
    
    // TODO: Add incoming edges (functions that call this function)
    // This requires a custom Gremlin query for incoming edges
    
    return Response.json({
      success: true,
      type: "function_dependencies",
      results: {
        functionId,
        function: functionVertex,
        calls: outgoingEdges,
        callCount: outgoingEdges.length,
        // calledBy: incomingEdges,
        // calledByCount: incomingEdges.length,
      },
    });
  } catch (error) {
    console.error("Function dependencies error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}