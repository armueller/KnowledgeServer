#!/usr/bin/env node

/**
 * Clean up the Neptune database mess:
 * 1. Delete test tenant data
 * 2. Delete duplicate vertices
 * 3. Fix visibility to be 'private' for all vertices
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'https://knowledge-server-dev.tabus10.com/api';
const USERNAME = 'austin@tabus10.com';
const PASSWORD = 'bh?UzE9BakV-mu8';

async function authenticate(): Promise<string> {
  console.log('🔐 Authenticating...');
  const response = await fetch(`${API_BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No session cookie received');
  }
  
  console.log('✅ Authenticated\n');
  return setCookie;
}

async function getAllFunctions(sessionCookie: string) {
  // Get ALL functions without limit
  const response = await fetch(`${API_BASE_URL}/knowledge?type=Function&limit=500`, {
    headers: { 'Cookie': sessionCookie },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch functions');
  }
  
  const data = await response.json();
  return data.data;
}

async function deleteVertex(sessionCookie: string, id: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/knowledge?id=${id}`, {
    method: 'DELETE',
    headers: { 'Cookie': sessionCookie },
  });
  
  return response.ok;
}

async function updateVertexVisibility(sessionCookie: string, id: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/knowledge?id=${id}`, {
    method: 'PUT',
    headers: { 
      'Cookie': sessionCookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ visibility: 'private' })
  });
  
  return response.ok;
}

async function main() {
  try {
    const sessionCookie = await authenticate();
    
    console.log('📥 Fetching all functions...');
    const functions = await getAllFunctions(sessionCookie);
    console.log(`Found ${functions.length} functions\n`);
    
    // Group functions by name to find duplicates
    const functionsByName = new Map<string, any[]>();
    for (const func of functions) {
      const existing = functionsByName.get(func.name) || [];
      existing.push(func);
      functionsByName.set(func.name, existing);
    }
    
    // Find and report duplicates
    let duplicatesDeleted = 0;
    console.log('🔍 Checking for duplicates...');
    for (const [name, funcs] of functionsByName.entries()) {
      if (funcs.length > 1) {
        console.log(`  ⚠️  ${name} has ${funcs.length} copies`);
        
        // Keep the first one, delete the rest
        for (let i = 1; i < funcs.length; i++) {
          const success = await deleteVertex(sessionCookie, funcs[i].id);
          if (success) {
            console.log(`    ✅ Deleted duplicate ${funcs[i].id}`);
            duplicatesDeleted++;
          } else {
            console.log(`    ❌ Failed to delete ${funcs[i].id}`);
          }
        }
      }
    }
    
    console.log(`\n✅ Deleted ${duplicatesDeleted} duplicate vertices\n`);
    
    // Delete vertices with wrong visibility
    console.log('🗑️  Deleting vertices with wrong visibility...');
    let wrongVisibilityDeleted = 0;
    const toDelete = [];
    
    // Re-fetch functions after deleting duplicates
    const remainingFunctions = await getAllFunctions(sessionCookie);
    
    for (const func of remainingFunctions) {
      if (func.visibility === 'public' || func.visibility === 'organization') {
        toDelete.push(func);
      }
    }
    
    console.log(`Found ${toDelete.length} vertices with wrong visibility to delete`);
    
    for (const func of toDelete) {
      const success = await deleteVertex(sessionCookie, func.id);
      if (success) {
        console.log(`  ✅ Deleted ${func.name} (was ${func.visibility})`);
        wrongVisibilityDeleted++;
      } else {
        console.log(`  ❌ Failed to delete ${func.name}`);
      }
    }
    
    console.log(`\n✅ Deleted ${wrongVisibilityDeleted} vertices with wrong visibility`);
    
    console.log('\n🎉 Cleanup complete!');
    console.log('💡 Now re-run the relationship migration with: npm run migrate:rmwm -- --relationships-only');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();