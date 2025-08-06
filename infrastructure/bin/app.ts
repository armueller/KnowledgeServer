#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();
const envName = app.node.tryGetContext('environment') || 'staging';
const appContext = app.node.tryGetContext('app');
const envConfig = appContext.environment[envName];

new AppStack(app, `${appContext.name}-${envName}`, {
  env: {
    account: process.env.PROFILE,
    region: 'us-west-2',
  },
  envName,
  config: envConfig,
});