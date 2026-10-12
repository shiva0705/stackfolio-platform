#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StackfolioBackendStack } from '../lib/backend-stack';
import { StackfolioFrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

// Get stage from context (alpha, beta, or gamma)
const stage = app.node.tryGetContext('stage') || 'alpha';

// Validate stage
if (!['alpha', 'beta', 'gamma'].includes(stage)) {
  throw new Error(`Invalid stage: ${stage}. Must be one of: alpha, beta, gamma`);
}

console.log(`🚀 Deploying Stackfolio to stage: ${stage}`);

// Common tags for all resources
const commonTags = {
  Project: 'Stackfolio',
  Stage: stage,
  ManagedBy: 'CDK',
  Environment: stage === 'gamma' ? 'production' : 'non-production',
};

// Backend Stack
const backendStack = new StackfolioBackendStack(app, `Stackfolio-Backend-${stage}`, {
  stage,
  stackName: `Stackfolio-Backend-${stage}`,
  description: `Stackfolio AI Portfolio Platform - Backend (${stage})`,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: commonTags,
});

// Frontend Stack (depends on backend for API endpoint)
const frontendStack = new StackfolioFrontendStack(app, `Stackfolio-Frontend-${stage}`, {
  stage,
  apiEndpoint: backendStack.apiEndpoint,
  userPoolId: backendStack.userPoolId,
  userPoolClientId: backendStack.userPoolClientId,
  stackName: `Stackfolio-Frontend-${stage}`,
  description: `Stackfolio AI Portfolio Platform - Frontend (${stage})`,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: commonTags,
});

frontendStack.addDependency(backendStack);

// Output deployment info
new cdk.CfnOutput(backendStack, 'DeploymentStage', {
  value: stage,
  description: 'Deployment stage',
});

new cdk.CfnOutput(backendStack, 'DeploymentTimestamp', {
  value: new Date().toISOString(),
  description: 'Deployment timestamp',
});

app.synth();
