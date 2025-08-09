import type { LoaderFunctionArgs } from "react-router";
import { apiLoaderWithUserAuth } from "~/middleware/loaderWithUserAuth";
import { dependencyAnalysis, impactAnalysis, patternDetection } from "~/handlers/analysis";

/**
 * Advanced analysis API endpoint
 * Provides dependency analysis, impact analysis, and pattern detection
 * 
 * Query parameters:
 * - type: analysis type (dependency, impact, pattern)
 * 
 * Dependency analysis params:
 * - vertexId: vertex to analyze
 * - direction: forward, reverse, or both
 * - maxDepth: maximum traversal depth
 * - includeIndirect: include indirect dependencies
 * 
 * Impact analysis params:
 * - vertexId: vertex to analyze
 * - changeType: modify, delete, or deprecate
 * - maxDepth: maximum impact depth
 * 
 * Pattern detection params:
 * - domain: filter by domain
 * - project: filter by project
 * - minOccurrences: minimum pattern occurrences
 * - similarity: similarity threshold
 */
export const loader = apiLoaderWithUserAuth(
  async ({ request, context }: LoaderFunctionArgs<{ userId: string }>) => {
    const url = new URL(request.url);
    const analysisType = url.searchParams.get("type");
    
    // Route to appropriate handler
    const handlers = {
      dependency: dependencyAnalysis,
      impact: impactAnalysis,
      pattern: patternDetection,
    };
    
    const handler = handlers[analysisType as keyof typeof handlers];
    
    if (!handler) {
      return Response.json(
        { 
          error: "Invalid analysis type. Use: dependency, impact, or pattern",
          validTypes: Object.keys(handlers),
        },
        { status: 400 }
      );
    }
    
    return handler(request, context);
  }
);