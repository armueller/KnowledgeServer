import type { ActionFunctionArgs } from "react-router";
import { getGraphTraversalSource } from "~/services/neptune/connection";

// Cleanup endpoint to fix Neptune mess - bypasses security
export async function action({ request }: ActionFunctionArgs) {
  const g = getGraphTraversalSource();
  
  try {
    // Count vertices with public visibility before deletion
    const publicCountBefore = await g.V()
      .has('visibility', 'public')
      .count()
      .next();
    
    console.log(`Deleting ${publicCountBefore.value} vertices with public visibility`);
    
    // Delete ALL vertices with public visibility in one operation
    await g.V()
      .has('visibility', 'public')
      .drop()
      .iterate();
    
    // Delete ALL test tenant data
    await g.V()
      .has('tenantId', 'test-tenant-001')
      .drop()
      .iterate();
    
    // Delete ALL vertices with organization visibility (test vertices)
    await g.V()
      .has('visibility', 'organization')
      .drop()
      .iterate();
    
    // Delete ALL vertices with team visibility (more test vertices)
    await g.V()
      .has('visibility', 'team')
      .drop()
      .iterate();
    
    // Get final counts
    const finalCount = await g.V()
      .has('type', 'Function')
      .count()
      .next();
    
    const visibilities = await g.V()
      .has('type', 'Function')
      .valueMap('visibility')
      .toList();
    
    const visibilityCount = new Map<string, number>();
    for (const v of visibilities) {
      const vis = v.visibility?.[0] || 'unknown';
      visibilityCount.set(vis, (visibilityCount.get(vis) || 0) + 1);
    }
    
    return Response.json({
      success: true,
      deletedPublic: publicCountBefore.value,
      remainingFunctions: finalCount.value,
      visibilityBreakdown: Object.fromEntries(visibilityCount),
      message: "All non-private vertices deleted"
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}