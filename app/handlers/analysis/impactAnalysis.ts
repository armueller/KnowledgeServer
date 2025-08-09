import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parseImpactParams } from "../utils/security";

interface ImpactedVertex {
  id: string;
  name: string;
  type: string;
  level: number;
  path: string[];
  impactType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface ImpactResult {
  source: {
    id: string;
    name: string;
    type: string;
  };
  changeType: string;
  impactedVertices: {
    critical: ImpactedVertex[];
    high: ImpactedVertex[];
    medium: ImpactedVertex[];
    low: ImpactedVertex[];
  };
  stats: {
    totalImpacted: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    maxDepth: number;
  };
  recommendations: string[];
}

/**
 * Analyze the impact of changes to a vertex
 * Shows what would be affected by modifying, deleting, or deprecating it
 */
export async function impactAnalysis(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const params = parseImpactParams(request);
  
  if (!params.vertexId) {
    return Response.json(
      { error: "vertexId parameter is required" },
      { status: 400 }
    );
  }

  try {
    const securityContext = await buildSecurityContext(context.userId);
    const repository = new KnowledgeGraphRepository(securityContext);
    
    // Get the source vertex
    const sourceVertex = await repository.vertices.findById(params.vertexId);
    if (!sourceVertex) {
      return Response.json(
        { error: "Vertex not found or access denied" },
        { status: 404 }
      );
    }

    // Analyze impact
    const impact = await repository.analyzeImpact(
      params.vertexId,
      params.changeType,
      params.maxDepth
    );

    // Calculate stats
    const stats = {
      totalImpacted: 
        impact.critical.length + 
        impact.high.length + 
        impact.medium.length + 
        impact.low.length,
      criticalCount: impact.critical.length,
      highCount: impact.high.length,
      mediumCount: impact.medium.length,
      lowCount: impact.low.length,
      maxDepth: Math.max(
        ...impact.critical.map((v: any) => v.level),
        ...impact.high.map((v: any) => v.level),
        ...impact.medium.map((v: any) => v.level),
        ...impact.low.map((v: any) => v.level),
        0
      ),
    };

    // Generate recommendations based on impact
    const recommendations = generateRecommendations(
      sourceVertex,
      params.changeType,
      stats,
      impact
    );

    const result: ImpactResult = {
      source: {
        id: sourceVertex.id,
        name: sourceVertex.name,
        type: sourceVertex.type,
      },
      changeType: params.changeType,
      impactedVertices: impact,
      stats,
      recommendations,
    };

    return Response.json({
      success: true,
      analysis: "impact",
      params,
      result,
    });

  } catch (error) {
    console.error("Impact analysis error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Generate recommendations based on impact analysis
 */
function generateRecommendations(
  sourceVertex: any,
  changeType: string,
  stats: any,
  impact: any
): string[] {
  const recommendations: string[] = [];

  // Critical impact recommendations
  if (stats.criticalCount > 0) {
    recommendations.push(
      `⚠️ CRITICAL: ${stats.criticalCount} components will break if this ${sourceVertex.type} is ${changeType}d`
    );
    
    if (changeType === 'delete') {
      recommendations.push(
        "Consider deprecating first instead of immediate deletion"
      );
    }
    
    recommendations.push(
      "Review and update all critical dependencies before proceeding"
    );
  }

  // High impact recommendations
  if (stats.highCount > 0) {
    recommendations.push(
      `High impact on ${stats.highCount} components - plan migration strategy`
    );
  }

  // Change type specific recommendations
  if (changeType === 'deprecate') {
    recommendations.push(
      "Document migration path for dependent components",
      "Set deprecation timeline and communicate to teams",
      "Consider creating compatibility wrapper if possible"
    );
  } else if (changeType === 'delete') {
    recommendations.push(
      "Ensure all dependencies have been migrated",
      "Create rollback plan in case of issues",
      "Consider phased deletion if impact is widespread"
    );
  } else if (changeType === 'modify') {
    recommendations.push(
      "Maintain backward compatibility if possible",
      "Version the changes if breaking changes are necessary",
      "Update documentation and notify affected teams"
    );
  }

  // Depth-based recommendations
  if (stats.maxDepth > 3) {
    recommendations.push(
      `Deep dependency chain detected (${stats.maxDepth} levels) - consider architectural refactoring`
    );
  }

  // General recommendations
  if (stats.totalImpacted > 10) {
    recommendations.push(
      `Significant impact scope (${stats.totalImpacted} components) - coordinate with multiple teams`
    );
  }

  if (stats.totalImpacted === 0) {
    recommendations.push(
      "No direct dependencies found - safe to proceed with changes"
    );
  }

  return recommendations;
}