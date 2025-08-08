#!/usr/bin/env node

/**
 * Test script to debug the exact Gremlin query issue
 */

import gremlin from 'gremlin';
import * as dotenv from 'dotenv';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const { driver: driverRuntime, process: gremlinProcess } = gremlin;
const { DriverRemoteConnection } = driverRuntime;
const { t, P, statics } = gremlinProcess;

async function testQuery() {
  const endpoint = process.env.NEPTUNE_ENDPOINT;
  const port = process.env.NEPTUNE_PORT || '8182';
  const neptuneWsUrl = `wss://${endpoint}:${port}/gremlin`;
  
  console.log(`Connecting to: ${neptuneWsUrl}`);
  
  const connection = new DriverRemoteConnection(neptuneWsUrl, {
    mimeType: 'application/vnd.gremlin-v2.0+json'
  });
  
  const g = new gremlin.structure.Graph().traversal().withRemote(connection);
  
  try {
    // Test 1: Find a vertex by ID directly
    console.log('\n📍 Test 1: Find vertex by ID directly');
    const vertex1 = await g.V().has('id', '84cc4512-1db7-eb6f-9192-a75b41e50f35').valueMap(true).next();
    console.log('Found vertex:', vertex1.value ? 'YES' : 'NO');
    if (vertex1.value) {
      console.log('Properties:', {
        id: vertex1.value.id,
        tenantId: vertex1.value.tenantId,
        userId: vertex1.value.userId,
        visibility: vertex1.value.visibility
      });
    }
    
    // Test 2: Find vertex with tenant filter
    console.log('\n📍 Test 2: Find vertex by ID with tenant filter');
    const vertex2 = await g.V()
      .has('id', '84cc4512-1db7-eb6f-9192-a75b41e50f35')
      .has('tenantId', 'default-tenant')
      .valueMap(true).next();
    console.log('Found vertex with tenant filter:', vertex2.value ? 'YES' : 'NO');
    
    // Test 3: Apply the security filter as in the code
    console.log('\n📍 Test 3: Apply security filter as in repository');
    const userId = '9841f3e0-d0f1-70a1-d85c-205ce47d06c8';
    const tenantId = 'default-tenant';
    const teamIds = ['default-team'];
    
    // This mimics the applySecurityFilter function
    const vertex3 = await g.V()
      .has('id', '84cc4512-1db7-eb6f-9192-a75b41e50f35')
      .has('tenantId', tenantId)
      .or(
        statics.has('userId', userId).has('visibility', 'private'),
        statics.has('teamId', P.within(...teamIds)).has('visibility', 'team'),
        statics.has('visibility', 'organization'),
        statics.has('sharedWith', userId)
      )
      .valueMap(true).next();
    console.log('Found vertex with security filter (using statics):', vertex3.value ? 'YES' : 'NO');
    
    // Test 4: Try with __ instead of statics
    console.log('\n📍 Test 4: Try with __ (anonymous traversal)');
    const __ = statics;
    const vertex4 = await g.V()
      .has('id', '84cc4512-1db7-eb6f-9192-a75b41e50f35')
      .has('tenantId', tenantId)
      .or(
        __.has('userId', userId).has('visibility', 'private'),
        __.has('teamId', P.within(...teamIds)).has('visibility', 'team'),
        __.has('visibility', 'organization'),
        __.has('sharedWith', userId)
      )
      .valueMap(true).next();
    console.log('Found vertex with __ syntax:', vertex4.value ? 'YES' : 'NO');
    
    // Test 5: Try without statics at all
    console.log('\n📍 Test 5: Try without any prefix');
    const vertex5 = await g.V()
      .has('id', '84cc4512-1db7-eb6f-9192-a75b41e50f35')
      .has('tenantId', tenantId)
      .or(
        t.has('userId', userId).has('visibility', 'private'),
        t.has('teamId', P.within(...teamIds)).has('visibility', 'team'),
        t.has('visibility', 'organization'),
        t.has('sharedWith', userId)
      )
      .valueMap(true).next();
    console.log('Found vertex with t prefix:', vertex5.value ? 'YES' : 'NO');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.close();
  }
}

testQuery().catch(console.error);