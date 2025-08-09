import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parseDependencyParams } from "../utils/security";

interface DependencyNode {
  id: string;
  name: string;
  type: string;
  level: number;
  directDependencies: string[];
  path: string[];
}

interface DependencyResult {
  root: {
    id: string;
    name: string;
    type: string;
  };
  forwardDependencies: DependencyNode[];
  reverseDependencies: DependencyNode[];
  circularDependencies: string[][];
  stats: {
    totalForward: number;
    totalReverse: number;
    maxDepth: number;
    hasCircular: boolean;
  };
}

/**
 * Analyze dependencies for a given vertex
 * Shows both what it depends on and what depends on it
 */
export async function dependencyAnalysis(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const params = parseDependencyParams(request);
  
  if (!params.vertexId) {
    return Response.json(
      { error: "vertexId parameter is required" },
      { status: 400 }
    );
  }

  try {
    const securityContext = await buildSecurityContext(context.userId);
    const repository = new KnowledgeGraphRepository(securityContext);
    
    // Get the root vertex
    const rootVertex = await repository.vertices.findById(params.vertexId);
    if (!rootVertex) {
      return Response.json(
        { error: "Vertex not found or access denied" },
        { status: 404 }
      );
    }

    // Default edge types for dependency analysis
    const edgeTypes = params.edgeTypes || [
      'DEPENDS_ON', 
      'CALLS', 
      'USES', 
      'IMPLEMENTS', 
      'EXTENDS', 
      'REFERENCES'
    ];

    const result: DependencyResult = {
      root: {
        id: rootVertex.id,
        name: rootVertex.name,
        type: rootVertex.type,
      },
      forwardDependencies: [],
      reverseDependencies: [],
      circularDependencies: [],
      stats: {
        totalForward: 0,
        totalReverse: 0,
        maxDepth: 0,
        hasCircular: false,
      },
    };

    // Analyze forward dependencies (what this depends on)
    if (params.direction === 'forward' || params.direction === 'both') {
      const forward = await repository.analyzeDependencies(
        params.vertexId,
        'out',
        edgeTypes,
        params.maxDepth,
        params.includeIndirect
      );
      result.forwardDependencies = forward.nodes;
      result.stats.totalForward = forward.nodes.length;
    }

    // Analyze reverse dependencies (what depends on this)
    if (params.direction === 'reverse' || params.direction === 'both') {
      const reverse = await repository.analyzeDependencies(
        params.vertexId,
        'in',
        edgeTypes,
        params.maxDepth,
        params.includeIndirect
      );
      result.reverseDependencies = reverse.nodes;
      result.stats.totalReverse = reverse.nodes.length;
    }

    // Check for circular dependencies
    if (params.includeIndirect) {
      const circular = await repository.detectCircularDependencies(
        params.vertexId,
        edgeTypes,
        params.maxDepth
      );
      result.circularDependencies = circular;
      result.stats.hasCircular = circular.length > 0;
    }

    // Calculate max depth from all nodes
    const allNodes = [...result.forwardDependencies, ...result.reverseDependencies];
    result.stats.maxDepth = allNodes.reduce((max, node) => 
      Math.max(max, node.level), 0
    );

    return Response.json({
      success: true,
      analysis: "dependency",
      params,
      result,
    });

  } catch (error) {
    console.error("Dependency analysis error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}