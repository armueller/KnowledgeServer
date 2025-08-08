#!/usr/bin/env node

/**
 * Test script to debug edge creation with detailed logging
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'https://knowledge-server-dev.tabus10.com/api';
const USERNAME = 'austin@tabus10.com';
const PASSWORD = 'bh?UzE9BakV-mu8';

async function authenticate(): Promise<string> {
  console.log('🔐 Authenticating...');
  const response = await fetch(`${API_BASE_URL}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No session cookie received');
  }
  
  console.log('✅ Authenticated');
  return setCookie;
}

async function createTestVertices(sessionCookie: string): Promise<[string, string]> {
  console.log('\n📦 Creating two test vertices with organization visibility...');
  
  // Create first vertex with organization visibility
  const response1 = await fetch(`${API_BASE_URL}/knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify({
      type: 'Function',
      name: `test_org_func1_${Date.now()}`,
      description: 'Test function 1 with org visibility',
      filePath: 'test.ts',
      signature: 'test1()',
      parameters: [],
      returnType: 'void',
      sideEffects: [],
      project: 'test',
      domain: 'test',
      visibility: 'organization', // Using organization visibility
      isAsync: false,
      isPure: true,
      lineStart: 1,
      lineEnd: 1,
      tags: ['test'],
      keywords: ['test'],
      status: 'active',
      confidence: 1.0,
      version: '1.0.0',
    }),
  });

  if (!response1.ok) {
    throw new Error(`Failed to create vertex 1: ${await response1.text()}`);
  }
  
  const vertex1 = await response1.json();
  console.log('Created vertex 1:', {
    id: vertex1.data.id,
    name: vertex1.data.name,
    visibility: vertex1.data.visibility,
    tenantId: vertex1.data.tenantId,
    userId: vertex1.data.userId,
  });
  
  // Create second vertex with organization visibility
  const response2 = await fetch(`${API_BASE_URL}/knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify({
      type: 'Function',
      name: `test_org_func2_${Date.now()}`,
      description: 'Test function 2 with org visibility',
      filePath: 'test.ts',
      signature: 'test2()',
      parameters: [],
      returnType: 'void',
      sideEffects: [],
      project: 'test',
      domain: 'test',
      visibility: 'organization', // Using organization visibility
      isAsync: false,
      isPure: true,
      lineStart: 1,
      lineEnd: 1,
      tags: ['test'],
      keywords: ['test'],
      status: 'active',
      confidence: 1.0,
      version: '1.0.0',
    }),
  });

  if (!response2.ok) {
    throw new Error(`Failed to create vertex 2: ${await response2.text()}`);
  }
  
  const vertex2 = await response2.json();
  console.log('Created vertex 2:', {
    id: vertex2.data.id,
    name: vertex2.data.name,
    visibility: vertex2.data.visibility,
    tenantId: vertex2.data.tenantId,
    userId: vertex2.data.userId,
  });
  
  return [vertex1.data.id, vertex2.data.id];
}

async function testEdgeCreation(sessionCookie: string, fromId: string, toId: string) {
  console.log(`\n🔗 Testing edge creation from ${fromId} to ${toId}...`);
  
  // Try with organization visibility
  console.log('Attempting with organization visibility...');
  const response = await fetch(`${API_BASE_URL}/relationships`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify({
      fromVertexId: fromId,
      toVertexId: toId,
      type: 'CALLS',
      visibility: 'organization',
    }),
  });

  const responseText = await response.text();
  console.log(`Response status: ${response.status}`);
  console.log(`Response: ${responseText}`);
  
  return response.ok;
}

async function cleanup(sessionCookie: string, id1: string, id2: string) {
  console.log('\n🧹 Cleaning up test vertices...');
  
  await fetch(`${API_BASE_URL}/knowledge?id=${id1}`, {
    method: 'DELETE',
    headers: { 'Cookie': sessionCookie },
  });
  
  await fetch(`${API_BASE_URL}/knowledge?id=${id2}`, {
    method: 'DELETE',
    headers: { 'Cookie': sessionCookie },
  });
  
  console.log('✅ Cleanup complete');
}

async function main() {
  let sessionCookie: string;
  let id1: string | null = null;
  let id2: string | null = null;
  
  try {
    sessionCookie = await authenticate();
    
    // Create vertices with organization visibility
    [id1, id2] = await createTestVertices(sessionCookie);
    
    // Test edge creation
    const success = await testEdgeCreation(sessionCookie, id1, id2);
    
    if (success) {
      console.log('\n✅ SUCCESS! Edge created successfully with organization visibility');
    } else {
      console.log('\n❌ FAILED! Edge creation failed even with organization visibility');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Clean up
    if (sessionCookie && id1 && id2) {
      await cleanup(sessionCookie, id1, id2);
    }
  }
}

main();