#!/usr/bin/env node

/**
 * Delete functions that were created with fallback SQLite data due to file path issues
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'https://knowledge-server-dev.tabus10.com/api';
const USERNAME = 'austin@tabus10.com';
const PASSWORD = 'bh?UzE9BakV-mu8';

// Functions that had file path issues and need to be re-migrated
const FUNCTIONS_TO_DELETE = [
  'processStockResearch',
  'processCompanyInfo', 
  'processFinancials',
  'processNews',
  'needsRefresh',
  'needsNewsUpdate',
  'needsQuarterlyRefresh',
  'optionRefreshActionHandler',
  'stockRefreshActionHandler',
  'getOptionDataLoader',
  'getStockDataLoader'
];

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
  
  console.log('✅ Authenticated\n');
  return setCookie;
}

async function deleteFunctionByName(sessionCookie: string, functionName: string): Promise<boolean> {
  try {
    // First find the function by name
    const searchResponse = await fetch(`${API_BASE_URL}/knowledge?type=Function&limit=200`, {
      headers: { 'Cookie': sessionCookie },
    });
    
    if (!searchResponse.ok) {
      console.error(`❌ Failed to search for function ${functionName}`);
      return false;
    }
    
    const searchData = await searchResponse.json();
    const func = searchData.data.find((f: any) => f.name === functionName);
    
    if (!func) {
      console.log(`⏭️  Function ${functionName} not found, skipping`);
      return true;
    }
    
    // Delete the function
    const deleteResponse = await fetch(`${API_BASE_URL}/knowledge?id=${func.id}`, {
      method: 'DELETE',
      headers: { 'Cookie': sessionCookie },
    });
    
    if (deleteResponse.ok) {
      console.log(`✅ Deleted function: ${functionName}`);
      return true;
    } else {
      const errorText = await deleteResponse.text();
      console.error(`❌ Failed to delete function ${functionName}: ${deleteResponse.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error deleting function ${functionName}:`, error);
    return false;
  }
}

async function main() {
  try {
    const sessionCookie = await authenticate();
    
    console.log(`🗑️  Deleting ${FUNCTIONS_TO_DELETE.length} functions with fallback data...\n`);
    
    let deleted = 0;
    for (const functionName of FUNCTIONS_TO_DELETE) {
      const success = await deleteFunctionByName(sessionCookie, functionName);
      if (success) deleted++;
    }
    
    console.log(`\n✅ Complete! Deleted ${deleted}/${FUNCTIONS_TO_DELETE.length} functions`);
    console.log('💡 Now re-run the migration to analyze these functions with proper file paths');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();