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

/**
 * Parse dependency analysis parameters
 */
export function parseDependencyParams(request: Request) {
  const url = new URL(request.url);
  
  return {
    vertexId: url.searchParams.get("vertexId"),
    direction: url.searchParams.get("direction") as "forward" | "reverse" | "both" || "both",
    maxDepth: parseInt(url.searchParams.get("maxDepth") || "5"),
    includeIndirect: url.searchParams.get("includeIndirect") !== "false",
    edgeTypes: url.searchParams.get("edgeTypes")?.split(",").map(t => t.trim()),
  };
}

/**
 * Parse impact analysis parameters
 */
export function parseImpactParams(request: Request) {
  const url = new URL(request.url);
  
  return {
    vertexId: url.searchParams.get("vertexId"),
    changeType: url.searchParams.get("changeType") as "modify" | "delete" | "deprecate" || "modify",
    maxDepth: parseInt(url.searchParams.get("maxDepth") || "3"),
    includeSeverity: url.searchParams.get("includeSeverity") !== "false",
  };
}

/**
 * Parse pattern detection parameters
 */
export function parsePatternParams(request: Request) {
  const url = new URL(request.url);
  
  return {
    domain: url.searchParams.get("domain"),
    project: url.searchParams.get("project"),
    patternType: url.searchParams.get("patternType"),
    minOccurrences: parseInt(url.searchParams.get("minOccurrences") || "2"),
    similarity: parseFloat(url.searchParams.get("similarity") || "0.8"),
    limit: parseInt(url.searchParams.get("limit") || "20"),
  };
}