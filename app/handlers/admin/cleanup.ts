import { getGraphTraversalSource } from "~/services/neptune/connection";

/**
 * Handle cleanup operations - removes vertices with wrong visibility
 * CAUTION: Bypasses security for emergency cleanup
 */
export async function cleanupVertices(request: Request): Promise<Response> {
  const g = getGraphTraversalSource();
  
  try {
    // Count vertices with non-private visibility before deletion
    const publicCount = await g.V()
      .has('visibility', 'public')
      .count()
      .next();
      
    const orgCount = await g.V()
      .has('visibility', 'organization')
      .count()
      .next();
      
    const teamCount = await g.V()
      .has('visibility', 'team')
      .count()
      .next();
    
    const totalToDelete = publicCount.value + orgCount.value + teamCount.value;
    
    console.log(`Deleting ${totalToDelete} vertices with wrong visibility`);
    
    // Delete all non-private vertices
    await g.V()
      .has('visibility', 'public')
      .drop()
      .iterate();
      
    await g.V()
      .has('visibility', 'organization')
      .drop()
      .iterate();
      
    await g.V()
      .has('visibility', 'team')
      .drop()
      .iterate();
    
    // Get final counts
    const finalCount = await g.V()
      .count()
      .next();
    
    return Response.json({
      success: true,
      deleted: {
        public: publicCount.value,
        organization: orgCount.value,
        team: teamCount.value,
        total: totalToDelete,
      },
      remaining: finalCount.value,
      message: "Non-private vertices deleted",
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
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
 * Delete test tenant data
 */
export async function cleanupTestData(request: Request): Promise<Response> {
  const g = getGraphTraversalSource();
  
  try {
    const testCount = await g.V()
      .has('tenantId', 'test-tenant-001')
      .count()
      .next();
    
    await g.V()
      .has('tenantId', 'test-tenant-001')
      .drop()
      .iterate();
    
    return Response.json({
      success: true,
      deleted: testCount.value,
      message: "Test tenant data deleted",
    });
    
  } catch (error) {
    console.error('Test data cleanup error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}