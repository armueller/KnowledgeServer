#!/usr/bin/env node

/**
 * Check visibility settings of vertices that failed relationship creation
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'https://knowledge-server-dev.tabus10.com/api';
const USERNAME = 'austin@tabus10.com';
const PASSWORD = 'bh?UzE9BakV-mu8';

// Sample of functions that failed relationship creation
const FUNCTIONS_TO_CHECK = [
  'sendSqsMessage',
  'sendStockAnalysisMessage',
  'refreshOptionData', 
  'refreshStockData',
  'getLatestStockPrice',
  'selectStockPricesForTickers',
  'selectOptionPricesForTickers',
  'calculatePortfolioSummary',
  'selectAllPositions',
  'optionsBatchActionHandler'
];

async function authenticate(): Promise<string> {
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
  
  return setCookie;
}

async function checkFunctionVisibility(sessionCookie: string) {
  // Get all functions
  const response = await fetch(`${API_BASE_URL}/knowledge?type=Function&limit=200`, {
    headers: { 'Cookie': sessionCookie },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch functions');
  }
  
  const data = await response.json();
  const visibilityStats = new Map<string, number>();
  
  console.log(`\n📦 Total functions in Neptune: ${data.data.length}`);
  
  // Check for unique tenantIds and userIds
  const tenantIds = new Set(data.data.map((f: any) => f.tenantId));
  const userIds = new Set(data.data.map((f: any) => f.userId));
  console.log(`📍 Unique tenantIds: ${Array.from(tenantIds).join(', ')}`);
  console.log(`👤 Unique userIds: ${Array.from(userIds).join(', ').substring(0, 50)}...`);
  
  // Check specific functions
  console.log('\n📊 Visibility of functions involved in failed relationships:\n');
  const notFound = [];
  for (const funcName of FUNCTIONS_TO_CHECK) {
    const func = data.data.find((f: any) => f.name === funcName);
    if (func) {
      console.log(`  ✅ ${funcName}: ${func.visibility} (userId: ${func.userId?.substring(0, 8)}...)`);
      visibilityStats.set(func.visibility, (visibilityStats.get(func.visibility) || 0) + 1);
    } else {
      console.log(`  ❌ ${funcName}: NOT FOUND`);
      notFound.push(funcName);
    }
  }
  
  if (notFound.length > 0) {
    console.log('\n🔍 Functions not found in Neptune (but should exist in SQLite):');
    for (const name of notFound) {
      console.log(`  - ${name}`);
    }
  }
  
  // Overall stats
  console.log('\n📈 Overall visibility distribution (all functions):\n');
  const allVisibility = new Map<string, number>();
  for (const func of data.data) {
    allVisibility.set(func.visibility, (allVisibility.get(func.visibility) || 0) + 1);
  }
  
  for (const [visibility, count] of allVisibility.entries()) {
    console.log(`  ${visibility}: ${count} functions`);
  }
}

async function main() {
  try {
    console.log('🔐 Authenticating...');
    const sessionCookie = await authenticate();
    console.log('✅ Authenticated');
    
    await checkFunctionVisibility(sessionCookie);
    
    console.log('\n💡 Insight: Relationship creation fails when vertices have different visibility levels.');
    console.log('   Solution: Either set all vertices to the same visibility (e.g., "organization")');
    console.log('   or update the security filter to allow edges between vertices with different visibility.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();