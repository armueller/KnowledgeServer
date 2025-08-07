#!/usr/bin/env node
/* eslint-disable no-console */
import { SSMClient, GetParameterCommand, type GetParameterCommandOutput } from '@aws-sdk/client-ssm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// TypeScript needs this for __dirname in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadSecrets(): Promise<void> {
  console.log('🔐 Loading parameters from AWS SSM Parameter Store...');

  try {
    const client = new SSMClient({
      profile: process.env.AWS_PROFILE,
    });
    
    // Environment-specific parameter paths
    const parametersToLoad: Record<string, string> = {
      [`/knowledge-server${process.env.NODE_ENV === 'prod' ? '' : '-dev'}/api-keys/neptune-endpoint`]: 'NEPTUNE_ENDPOINT',
      [`/knowledge-server${process.env.NODE_ENV === 'prod' ? '' : '-dev'}/api-keys/neptune-read-endpoint`]: 'NEPTUNE_READ_ENDPOINT',
      [`/knowledge-server${process.env.NODE_ENV === 'prod' ? '' : '-dev'}/api-keys/neptune-port`]: 'NEPTUNE_PORT',
    };

    let envContent = '\n# AWS SSM Parameters - Auto-generated for local development\n';

    for (const parameterName of Object.keys(parametersToLoad)) {
      console.log(parameterName);
      try {
        const command = new GetParameterCommand({ Name: parameterName });
        const response: GetParameterCommandOutput = await client.send(command);

        if (response.Parameter?.Value) {
          envContent += `${parametersToLoad[parameterName]}=${response.Parameter.Value}\n`;
        } else {
          console.error(`Error loading parameter ${parameterName}:`, response);
        }
      } catch (error) {
        console.warn(`⚠️  Could not load parameter ${parameterName}:`, error instanceof Error ? error.message : String(error));
        console.log('    This is expected if the parameter doesn\'t exist yet. Create it after deployment.');
      }
    }

    const envPath = path.resolve(__dirname, '..', '.env.local');
    fs.writeFileSync(envPath, envContent, { encoding: 'utf8', flag: 'w' });

    console.log('✅ Parameters loaded successfully into .env.local');
  } catch (error) {
    console.error('❌ Error loading parameters:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Self-executing async function
(async (): Promise<void> => {
  await loadSecrets();
})().catch((error: unknown) => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});