import type { LoaderFunctionArgs } from "react-router";
import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import type { SecurityContext } from "~/models/neptune/types";

/**
 * Advanced search API endpoint for knowledge graph queries
 * Supports domain-based, tag-based, and project-based searches with graph traversal
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchType = url.searchParams.get("type");
  const domain = url.searchParams.get("domain");
  const tag = url.searchParams.get("tag");
  const project = url.searchParams.get("project");
  const depth = parseInt(url.searchParams.get("depth") || "2");
  const limit = parseInt(url.searchParams.get("limit") || "50");

  // Mock security context - in production this would come from session
  const securityContext: SecurityContext = {
    tenantId: "default-tenant",
    userId: "9841f3e0-d0f1-70a1-d85c-205ce47d06c8",
    teamIds: [],
  };

  const repository = new KnowledgeGraphRepository(securityContext);

  try {
    switch (searchType) {
      case "domain":
        if (!domain) {
          return Response.json({ error: "Domain parameter required" }, { status: 400 });
        }
        
        const domainResults = await repository.vertices.query({
          vertexFilters: { domain },
          limit,
          orderBy: "name"
        });

        return Response.json({
          success: true,
          type: "domain_search",
          query: { domain, limit },
          results: domainResults.data,
          count: domainResults.count,
          hasMore: domainResults.hasMore
        });

      case "tag":
        if (!tag) {
          return Response.json({ error: "Tag parameter required" }, { status: 400 });
        }

        const tagResults = await repository.vertices.query({
          vertexFilters: { tags: [tag] },
          limit,
          orderBy: "name"
        });

        return Response.json({
          success: true,
          type: "tag_search",
          query: { tag, limit },
          results: tagResults.data,
          count: tagResults.count,
          hasMore: tagResults.hasMore
        });

      case "project":
        if (!project) {
          return Response.json({ error: "Project parameter required" }, { status: 400 });
        }

        const projectResults = await repository.vertices.query({
          vertexFilters: { project },
          limit,
          orderBy: "name"
        });

        return Response.json({
          success: true,
          type: "project_search",
          query: { project, limit },
          results: projectResults.data,
          count: projectResults.count,
          hasMore: projectResults.hasMore
        });

      case "traversal":
        const startId = url.searchParams.get("startId");
        const edgeTypes = url.searchParams.get("edgeTypes")?.split(",");
        
        if (!startId) {
          return Response.json({ error: "StartId parameter required for traversal" }, { status: 400 });
        }

        const traversalResults = await repository.traverseGraph(startId, depth, edgeTypes);

        return Response.json({
          success: true,
          type: "graph_traversal",
          query: { startId, depth, edgeTypes },
          results: traversalResults,
          pathCount: traversalResults.length
        });

      case "function_dependencies":
        const functionId = url.searchParams.get("functionId");
        
        if (!functionId) {
          return Response.json({ error: "FunctionId parameter required" }, { status: 400 });
        }

        // Find all functions this function calls (outgoing relationships)
        const outgoingEdges = await repository.edges.findEdgesFrom(functionId, "CALLS");
        
        // Find what calls this function (incoming relationships would require a custom query)
        const dependencyResults = {
          functionId,
          calls: outgoingEdges,
          callCount: outgoingEdges.length
        };

        return Response.json({
          success: true,
          type: "function_dependencies",
          results: dependencyResults
        });

      default:
        return Response.json({
          error: "Invalid search type. Supported types: domain, tag, project, traversal, function_dependencies"
        }, { status: 400 });
    }

  } catch (error) {
    console.error("Advanced search error:", error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}