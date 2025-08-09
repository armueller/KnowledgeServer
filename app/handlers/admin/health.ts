import { getGraphTraversalSource } from "~/services/neptune/connection";

/**
 * Health check handler for Neptune database
 */
export async function healthCheck(request: Request): Promise<Response> {
  const g = getGraphTraversalSource();
  
  try {
    // Test basic connectivity with a simple count
    const vertexCount = await g.V().limit(1).count().next();
    
    // Get database statistics
    const stats = await g.V()
      .group()
      .by('type')
      .by(__.count())
      .next();
    
    const edgeCount = await g.E().count().next();
    
    return Response.json({
      status: "healthy",
      database: "neptune",
      connected: true,
      statistics: {
        totalVertices: Object.values(stats.value).reduce((a: any, b: any) => a + b, 0),
        totalEdges: edgeCount.value,
        vertexTypes: stats.value,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return Response.json(
      {
        status: "unhealthy",
        database: "neptune",
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

/**
 * Get detailed database statistics
 */
export async function databaseStats(request: Request): Promise<Response> {
  const g = getGraphTraversalSource();
  
  try {
    // Get vertex counts by type
    const vertexStats = await g.V()
      .group()
      .by('type')
      .by(__.count())
      .next();
    
    // Get edge counts by type
    const edgeStats = await g.E()
      .group()
      .by(__.label())
      .by(__.count())
      .next();
    
    // Get tenant statistics
    const tenantStats = await g.V()
      .group()
      .by('tenantId')
      .by(__.count())
      .next();
    
    // Get visibility statistics
    const visibilityStats = await g.V()
      .group()
      .by('visibility')
      .by(__.count())
      .next();
    
    return Response.json({
      success: true,
      statistics: {
        vertices: vertexStats.value,
        edges: edgeStats.value,
        tenants: tenantStats.value,
        visibility: visibilityStats.value,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Import anonymous traversal
import gremlin from 'gremlin';
const __ = gremlin.process.statics;