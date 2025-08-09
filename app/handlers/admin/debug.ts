import { getGraphTraversalSource } from "~/services/neptune/connection";

/**
 * Debug handler - inspect Neptune data without security filters
 * CAUTION: Bypasses security for debugging
 */
export async function debugVertices(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const vertexType = url.searchParams.get("type") || "Function";
  const name = url.searchParams.get("name");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  
  const g = getGraphTraversalSource();
  
  try {
    if (name) {
      // Find specific vertex by name
      const vertices = await g.V()
        .has('type', vertexType)
        .has('name', name)
        .valueMap(true)
        .toList();
      
      return Response.json({
        success: true,
        count: vertices.length,
        vertices: vertices.map((v: any) => ({
          id: v.id,
          name: v.name,
          type: v.label,
          tenantId: v.tenantId,
          userId: v.userId,
          visibility: v.visibility,
          teamId: v.teamId,
        })),
      });
    }
    
    // Get counts and samples
    const totalCount = await g.V()
      .has('type', vertexType)
      .count()
      .next();
    
    const sample = await g.V()
      .has('type', vertexType)
      .limit(limit)
      .valueMap(true)
      .toList();
    
    // Get unique values for debugging
    const allVertices = await g.V()
      .has('type', vertexType)
      .valueMap('tenantId', 'userId', 'visibility')
      .toList();
    
    const tenantIds = new Set(allVertices.map((v: any) => v.tenantId?.[0]));
    const userIds = new Set(allVertices.map((v: any) => v.userId?.[0]));
    const visibilities = new Set(allVertices.map((v: any) => v.visibility?.[0]));
    
    return Response.json({
      success: true,
      type: vertexType,
      total: totalCount.value,
      uniqueTenantIds: Array.from(tenantIds),
      uniqueUserIds: Array.from(userIds),
      uniqueVisibilities: Array.from(visibilities),
      sample: sample.slice(0, 3).map((v: any) => ({
        id: v.id,
        name: v.name,
        tenantId: v.tenantId,
        userId: v.userId,
        visibility: v.visibility,
      })),
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

/**
 * Get visibility breakdown for all vertices
 */
export async function debugVisibility(request: Request): Promise<Response> {
  const g = getGraphTraversalSource();
  
  try {
    const visibilityGroups = await g.V()
      .group()
      .by('visibility')
      .by(__.count())
      .next();
    
    const typeBreakdown = await g.V()
      .group()
      .by('type')
      .by(
        __.group()
          .by('visibility')
          .by(__.count())
      )
      .next();
    
    return Response.json({
      success: true,
      visibilityBreakdown: visibilityGroups.value,
      typeBreakdown: typeBreakdown.value,
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