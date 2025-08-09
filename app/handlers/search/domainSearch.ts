import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parseSearchParams } from "../utils/security";

/**
 * Handle domain-based search requests
 * Context contains validated userId from middleware
 */
export async function domainSearch(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const { domain, limit, offset, orderBy, orderDirection } = parseSearchParams(request);
  
  if (!domain) {
    return Response.json(
      { error: "Domain parameter required" },
      { status: 400 }
    );
  }
  
  try {
    // Build security context from validated userId (no re-validation!)
    const securityContext = await buildSecurityContext(context.userId);
    const repository = new KnowledgeGraphRepository(securityContext);
    
    const results = await repository.vertices.query({
      securityContext,
      vertexFilters: { domain },
      limit,
      offset,
      orderBy,
      orderDirection,
    });
    
    return Response.json({
      success: true,
      type: "domain_search",
      query: { domain, limit, offset },
      results: results.data,
      count: results.count,
      hasMore: results.hasMore,
    });
  } catch (error) {
    console.error("Domain search error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}