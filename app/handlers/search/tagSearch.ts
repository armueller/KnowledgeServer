import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parseSearchParams } from "../utils/security";

/**
 * Handle tag-based search requests
 * Context contains validated userId from middleware
 */
export async function tagSearch(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const { tag, project, limit, offset, orderBy, orderDirection } = parseSearchParams(request);
  
  const url = new URL(request.url);
  const tagMatch = url.searchParams.get("tagMatch") || "partial"; // "exact", "partial", or "regex"
  
  if (!tag) {
    return Response.json(
      { error: "Tag parameter required" },
      { status: 400 }
    );
  }
  
  try {
    // Build security context from validated userId (no re-validation!)
    const securityContext = await buildSecurityContext(context.userId);
    const repository = new KnowledgeGraphRepository(securityContext);
    
    // Build filters with optional project filtering
    const vertexFilters: any = {};
    if (tagMatch === "exact") {
      vertexFilters.tags = [tag];
    } else if (tagMatch === "regex") {
      vertexFilters.tagRegex = tag;
    } else {
      vertexFilters.tagPattern = tag;
    }
    if (project) {
      vertexFilters.project = project;
    }
    
    const results = await repository.vertices.query({
      securityContext,
      vertexFilters,
      limit,
      offset,
      orderBy,
      orderDirection,
    });
    
    return Response.json({
      success: true,
      type: "tag_search",
      query: { tag, project, limit, offset },
      results: results.data,
      count: results.count,
      hasMore: results.hasMore,
    });
  } catch (error) {
    console.error("Tag search error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}