import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parseSearchParams } from "../utils/security";

/**
 * Handle listing/querying knowledge entries with filters
 */
export async function listKnowledge(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const { domain, project, limit, offset, orderBy, orderDirection } = parseSearchParams(request);
  
  // Additional params specific to knowledge listing
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const name = url.searchParams.get("name");
  const nameMatch = url.searchParams.get("nameMatch") || "partial"; // "exact" or "partial"
  
  try {
    const securityContext = await buildSecurityContext(context.userId);
    const repo = new KnowledgeGraphRepository(securityContext);
    
    // Build filters
    const filters: any = {};
    if (type) filters.type = type;
    if (project) filters.project = project;
    if (domain) filters.domain = domain;
    if (name) {
      if (nameMatch === "exact") {
        filters.name = name;
      } else {
        // For partial matching, we'll use a name pattern
        filters.namePattern = name;
      }
    }
    
    const results = await repo.vertices.query({
      securityContext,
      vertexFilters: filters,
      limit,
      offset,
      orderBy,
      orderDirection,
    });
    
    return Response.json({
      success: true,
      data: results.data,
      pagination: {
        total: results.count,
        limit,
        offset,
        hasMore: results.hasMore,
      },
    });
  } catch (error) {
    console.error("List knowledge error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}