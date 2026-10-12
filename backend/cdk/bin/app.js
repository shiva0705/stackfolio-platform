#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const backend_stack_1 = require("../lib/backend-stack");
const frontend_stack_1 = require("../lib/frontend-stack");
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
const backendStack = new backend_stack_1.StackfolioBackendStack(app, `Stackfolio-Backend-${stage}`, {
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
const frontendStack = new frontend_stack_1.StackfolioFrontendStack(app, `Stackfolio-Frontend-${stage}`, {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsd0RBQThEO0FBQzlELDBEQUFnRTtBQUVoRSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixpREFBaUQ7QUFDakQsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksT0FBTyxDQUFDO0FBRXpELGlCQUFpQjtBQUNqQixJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO0lBQ2hELE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLEtBQUssc0NBQXNDLENBQUMsQ0FBQztBQUNqRixDQUFDO0FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQ0FBcUMsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUUxRCxnQ0FBZ0M7QUFDaEMsTUFBTSxVQUFVLEdBQUc7SUFDakIsT0FBTyxFQUFFLFlBQVk7SUFDckIsS0FBSyxFQUFFLEtBQUs7SUFDWixTQUFTLEVBQUUsS0FBSztJQUNoQixXQUFXLEVBQUUsS0FBSyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0I7Q0FDakUsQ0FBQztBQUVGLGdCQUFnQjtBQUNoQixNQUFNLFlBQVksR0FBRyxJQUFJLHNDQUFzQixDQUFDLEdBQUcsRUFBRSxzQkFBc0IsS0FBSyxFQUFFLEVBQUU7SUFDbEYsS0FBSztJQUNMLFNBQVMsRUFBRSxzQkFBc0IsS0FBSyxFQUFFO0lBQ3hDLFdBQVcsRUFBRSwrQ0FBK0MsS0FBSyxHQUFHO0lBQ3BFLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0lBQ0QsSUFBSSxFQUFFLFVBQVU7Q0FDakIsQ0FBQyxDQUFDO0FBRUgsdURBQXVEO0FBQ3ZELE1BQU0sYUFBYSxHQUFHLElBQUksd0NBQXVCLENBQUMsR0FBRyxFQUFFLHVCQUF1QixLQUFLLEVBQUUsRUFBRTtJQUNyRixLQUFLO0lBQ0wsV0FBVyxFQUFFLFlBQVksQ0FBQyxXQUFXO0lBQ3JDLFVBQVUsRUFBRSxZQUFZLENBQUMsVUFBVTtJQUNuQyxnQkFBZ0IsRUFBRSxZQUFZLENBQUMsZ0JBQWdCO0lBQy9DLFNBQVMsRUFBRSx1QkFBdUIsS0FBSyxFQUFFO0lBQ3pDLFdBQVcsRUFBRSxnREFBZ0QsS0FBSyxHQUFHO0lBQ3JFLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0lBQ0QsSUFBSSxFQUFFLFVBQVU7Q0FDakIsQ0FBQyxDQUFDO0FBRUgsYUFBYSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUUxQyx5QkFBeUI7QUFDekIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxpQkFBaUIsRUFBRTtJQUNqRCxLQUFLLEVBQUUsS0FBSztJQUNaLFdBQVcsRUFBRSxrQkFBa0I7Q0FDaEMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxxQkFBcUIsRUFBRTtJQUNyRCxLQUFLLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7SUFDL0IsV0FBVyxFQUFFLHNCQUFzQjtDQUNwQyxDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgU3RhY2tmb2xpb0JhY2tlbmRTdGFjayB9IGZyb20gJy4uL2xpYi9iYWNrZW5kLXN0YWNrJztcbmltcG9ydCB7IFN0YWNrZm9saW9Gcm9udGVuZFN0YWNrIH0gZnJvbSAnLi4vbGliL2Zyb250ZW5kLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IHN0YWdlIGZyb20gY29udGV4dCAoYWxwaGEsIGJldGEsIG9yIGdhbW1hKVxuY29uc3Qgc3RhZ2UgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFnZScpIHx8ICdhbHBoYSc7XG5cbi8vIFZhbGlkYXRlIHN0YWdlXG5pZiAoIVsnYWxwaGEnLCAnYmV0YScsICdnYW1tYSddLmluY2x1ZGVzKHN0YWdlKSkge1xuICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc3RhZ2U6ICR7c3RhZ2V9LiBNdXN0IGJlIG9uZSBvZjogYWxwaGEsIGJldGEsIGdhbW1hYCk7XG59XG5cbmNvbnNvbGUubG9nKGDwn5qAIERlcGxveWluZyBTdGFja2ZvbGlvIHRvIHN0YWdlOiAke3N0YWdlfWApO1xuXG4vLyBDb21tb24gdGFncyBmb3IgYWxsIHJlc291cmNlc1xuY29uc3QgY29tbW9uVGFncyA9IHtcbiAgUHJvamVjdDogJ1N0YWNrZm9saW8nLFxuICBTdGFnZTogc3RhZ2UsXG4gIE1hbmFnZWRCeTogJ0NESycsXG4gIEVudmlyb25tZW50OiBzdGFnZSA9PT0gJ2dhbW1hJyA/ICdwcm9kdWN0aW9uJyA6ICdub24tcHJvZHVjdGlvbicsXG59O1xuXG4vLyBCYWNrZW5kIFN0YWNrXG5jb25zdCBiYWNrZW5kU3RhY2sgPSBuZXcgU3RhY2tmb2xpb0JhY2tlbmRTdGFjayhhcHAsIGBTdGFja2ZvbGlvLUJhY2tlbmQtJHtzdGFnZX1gLCB7XG4gIHN0YWdlLFxuICBzdGFja05hbWU6IGBTdGFja2ZvbGlvLUJhY2tlbmQtJHtzdGFnZX1gLFxuICBkZXNjcmlwdGlvbjogYFN0YWNrZm9saW8gQUkgUG9ydGZvbGlvIFBsYXRmb3JtIC0gQmFja2VuZCAoJHtzdGFnZX0pYCxcbiAgZW52OiB7XG4gICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyxcbiAgfSxcbiAgdGFnczogY29tbW9uVGFncyxcbn0pO1xuXG4vLyBGcm9udGVuZCBTdGFjayAoZGVwZW5kcyBvbiBiYWNrZW5kIGZvciBBUEkgZW5kcG9pbnQpXG5jb25zdCBmcm9udGVuZFN0YWNrID0gbmV3IFN0YWNrZm9saW9Gcm9udGVuZFN0YWNrKGFwcCwgYFN0YWNrZm9saW8tRnJvbnRlbmQtJHtzdGFnZX1gLCB7XG4gIHN0YWdlLFxuICBhcGlFbmRwb2ludDogYmFja2VuZFN0YWNrLmFwaUVuZHBvaW50LFxuICB1c2VyUG9vbElkOiBiYWNrZW5kU3RhY2sudXNlclBvb2xJZCxcbiAgdXNlclBvb2xDbGllbnRJZDogYmFja2VuZFN0YWNrLnVzZXJQb29sQ2xpZW50SWQsXG4gIHN0YWNrTmFtZTogYFN0YWNrZm9saW8tRnJvbnRlbmQtJHtzdGFnZX1gLFxuICBkZXNjcmlwdGlvbjogYFN0YWNrZm9saW8gQUkgUG9ydGZvbGlvIFBsYXRmb3JtIC0gRnJvbnRlbmQgKCR7c3RhZ2V9KWAsXG4gIGVudjoge1xuICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXG4gIH0sXG4gIHRhZ3M6IGNvbW1vblRhZ3MsXG59KTtcblxuZnJvbnRlbmRTdGFjay5hZGREZXBlbmRlbmN5KGJhY2tlbmRTdGFjayk7XG5cbi8vIE91dHB1dCBkZXBsb3ltZW50IGluZm9cbm5ldyBjZGsuQ2ZuT3V0cHV0KGJhY2tlbmRTdGFjaywgJ0RlcGxveW1lbnRTdGFnZScsIHtcbiAgdmFsdWU6IHN0YWdlLFxuICBkZXNjcmlwdGlvbjogJ0RlcGxveW1lbnQgc3RhZ2UnLFxufSk7XG5cbm5ldyBjZGsuQ2ZuT3V0cHV0KGJhY2tlbmRTdGFjaywgJ0RlcGxveW1lbnRUaW1lc3RhbXAnLCB7XG4gIHZhbHVlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gIGRlc2NyaXB0aW9uOiAnRGVwbG95bWVudCB0aW1lc3RhbXAnLFxufSk7XG5cbmFwcC5zeW50aCgpO1xuIl19