#!/usr/bin/env node

/**
 * Test script to debug Neptune security issues
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

async function getCurrentUser(sessionCookie: string): Promise<string> {
  console.log('👤 Getting current user context...');
  
  // Create a test vertex to see what userId is being used
  const response = await fetch(`${API_BASE_URL}/knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify({
      type: 'Function',
      name: `test_security_${Date.now()}`,
      description: 'Test vertex for security debugging',
      filePath: 'test.ts',
      signature: 'test()',
      parameters: [],
      returnType: 'void',
      sideEffects: [],
      project: 'test',
      domain: 'test',
      visibility: 'private',
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

  if (response.ok) {
    const data = await response.json();
    console.log('Current user context:', {
      userId: data.data.userId,
      tenantId: data.data.tenantId,
      teamId: data.data.teamId,
    });
    
    // Clean up - delete the test vertex
    await fetch(`${API_BASE_URL}/knowledge?id=${data.data.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': sessionCookie,
      },
    });
    
    return data.data.userId;
  }
  
  return 'unknown';
}

async function getVertices(sessionCookie: string) {
  console.log('\n📥 Getting existing vertices...');
  
  const response = await fetch(`${API_BASE_URL}/knowledge?type=Function&limit=2`, {
    headers: {
      'Cookie': sessionCookie,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get vertices: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Found ${data.data.length} vertices`);
  
  if (data.data.length >= 2) {
    console.log('Vertex 1:', {
      id: data.data[0].id,
      name: data.data[0].name,
      tenantId: data.data[0].tenantId,
      userId: data.data[0].userId,
      visibility: data.data[0].visibility,
      teamId: data.data[0].teamId,
    });
    console.log('Vertex 2:', {
      id: data.data[1].id,
      name: data.data[1].name,
      tenantId: data.data[1].tenantId,
      userId: data.data[1].userId,
      visibility: data.data[1].visibility,
      teamId: data.data[1].teamId,
    });
    
    return [data.data[0].id, data.data[1].id];
  }
  
  return [];
}

async function testEdgeCreation(sessionCookie: string, fromId: string, toId: string) {
  console.log(`\n🔗 Testing edge creation from ${fromId} to ${toId}...`);
  
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
      visibility: 'organization', // Try organization visibility
    }),
  });

  const responseText = await response.text();
  console.log(`Response status: ${response.status}`);
  console.log(`Response: ${responseText}`);
  
  if (!response.ok) {
    // Try with different visibility
    console.log('\n🔗 Trying with private visibility...');
    const response2 = await fetch(`${API_BASE_URL}/relationships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({
        fromVertexId: fromId,
        toVertexId: toId,
        type: 'CALLS',
        visibility: 'private',
      }),
    });
    
    const responseText2 = await response2.text();
    console.log(`Response status: ${response2.status}`);
    console.log(`Response: ${responseText2}`);
  }
}

async function main() {
  try {
    const sessionCookie = await authenticate();
    const currentUserId = await getCurrentUser(sessionCookie);
    const [fromId, toId] = await getVertices(sessionCookie);
    
    if (fromId && toId) {
      await testEdgeCreation(sessionCookie, fromId, toId);
    } else {
      console.log('❌ Not enough vertices to test edge creation');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();