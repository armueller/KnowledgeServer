/**
 * Parse common search parameters from request
 */
export function parseSearchParams(request: Request) {
  const url = new URL(request.url);
  
  return {
    domain: url.searchParams.get("domain"),
    tag: url.searchParams.get("tag"),
    project: url.searchParams.get("project"),
    limit: parseInt(url.searchParams.get("limit") || "50"),
    offset: parseInt(url.searchParams.get("offset") || "0"),
    orderBy: url.searchParams.get("orderBy") || "name",
    orderDirection: url.searchParams.get("orderDirection") as "ASC" | "DESC" || "ASC",
  };
}

/**
 * Parse graph traversal parameters
 */
export function parseTraversalParams(request: Request) {
  const url = new URL(request.url);
  
  return {
    startId: url.searchParams.get("startId"),
    depth: parseInt(url.searchParams.get("depth") || "2"),
    edgeTypes: url.searchParams.get("edgeTypes")?.split(","),
    limit: parseInt(url.searchParams.get("limit") || "100"),
  };
}

/**
 * Parse relationship/edge parameters
 */
export function parseRelationshipParams(request: Request) {
  const url = new URL(request.url);
  
  return {
    operation: url.searchParams.get("op") || "list",
    fromVertexId: url.searchParams.get("from"),
    toVertexId: url.searchParams.get("to"),
    edgeType: url.searchParams.get("type"),
    edgeId: url.searchParams.get("id"),
    depth: parseInt(url.searchParams.get("depth") || "2"),
    edgeTypes: url.searchParams.get("edgeTypes")?.split(",").map(t => t.trim()),
  };
}