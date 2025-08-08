import type { LoaderFunctionArgs } from "react-router";
import { getGraphTraversalSource } from "~/services/neptune/connection";

// Debug endpoint to check all vertices without security filters
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const funcName = url.searchParams.get("name");
  
  const g = getGraphTraversalSource();
  
  try {
    if (funcName) {
      // Find specific function by name without security
      const vertices = await g.V()
        .has('type', 'Function')
        .has('name', funcName)
        .valueMap(true)
        .toList();
      
      return Response.json({
        success: true,
        count: vertices.length,
        vertices: vertices.map((v: any) => ({
          id: v.id,
          name: v.name,
          tenantId: v.tenantId,
          userId: v.userId,
          visibility: v.visibility,
          teamId: v.teamId
        }))
      });
    } else {
      // Count all functions without security
      const totalCount = await g.V()
        .has('type', 'Function')
        .count()
        .next();
      
      // Get sample of functions with different properties
      const sample = await g.V()
        .has('type', 'Function')
        .limit(10)
        .valueMap(true)
        .toList();
      
      // Get unique tenantIds and userIds
      const allVertices = await g.V()
        .has('type', 'Function')
        .valueMap('tenantId', 'userId', 'visibility')
        .toList();
      
      const tenantIds = new Set(allVertices.map((v: any) => v.tenantId?.[0]));
      const userIds = new Set(allVertices.map((v: any) => v.userId?.[0]));
      const visibilities = new Set(allVertices.map((v: any) => v.visibility?.[0]));
      
      return Response.json({
        success: true,
        totalFunctions: totalCount.value,
        uniqueTenantIds: Array.from(tenantIds),
        uniqueUserIds: Array.from(userIds),
        uniqueVisibilities: Array.from(visibilities),
        sample: sample.slice(0, 3).map((v: any) => ({
          name: v.name,
          tenantId: v.tenantId,
          userId: v.userId,
          visibility: v.visibility
        }))
      });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}