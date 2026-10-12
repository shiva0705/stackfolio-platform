# Stackfolio Deployment Guide

## Stage Overview

Stackfolio uses a three-stage deployment strategy:

| Stage | Purpose | Deploy Method | AWS Resources |
|-------|---------|---------------|---------------|
| **Alpha** | Local development testing | Manual from Mac (`npm run deploy:alpha`) | `stackfolio-*-alpha-*` |
| **Beta** | Pre-production staging | Auto from GitHub (merge to `main`) | `stackfolio-*-beta-*` |
| **Gamma** | Production | Auto after beta tests pass | `stackfolio-*-gamma-*` |

All resources are cleanly separated by stage in their names and tags.

## Prerequisites

1. **AWS Account** (use stackfolio-shiva credentials)
2. **AWS CLI** configured with credentials
3. **Node.js 20+** installed
4. **AWS CDK** bootstrapped in your account

### First-Time Setup

```bash
# 1. Install AWS CLI (if not already installed)
brew install awscli

# 2. Configure AWS credentials (use stackfolio-shiva profile)
aws configure --profile stackfolio-shiva
# Enter:
#   AWS Access Key ID: <your-key>
#   AWS Secret Access Key: <your-secret>
#   Default region: us-east-1
#   Default output format: json

# 3. Export profile for this session
export AWS_PROFILE=stackfolio-shiva

# 4. Bootstrap CDK (one-time per account/region)
cd backend/cdk
npm install
npx cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

## Alpha Stage - Local Deployment

Alpha is YOUR personal testing environment. Deploy directly from your Mac.

### Deploy Alpha

```bash
# From project root
cd backend

# 1. Build Lambda functions
npm run build

# 2. Deploy to Alpha
cd cdk
npm run deploy:alpha
```

This will create:
- ✅ S3 bucket: `stackfolio-content-alpha-{account-id}`
- ✅ Lambdas: `stackfolio-*-alpha`
- ✅ API Gateway: `stackfolio-api-alpha`
- ✅ Cognito User Pool: `stackfolio-users-alpha`
- ✅ CloudFront distributions for dashboard and portfolios

### View Alpha Resources

```bash
# See what's deployed
npm run cdk -- list --context stage=alpha

# See difference before deploying
npm run diff:alpha

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name Stackfolio-Backend-alpha \
  --profile stackfolio-shiva \
  --query 'Stacks[0].Outputs'
```

### Test Alpha

```bash
# Get API endpoint from outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name Stackfolio-Backend-alpha \
  --profile stackfolio-shiva \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Health check
curl $API_ENDPOINT/health
```

### Destroy Alpha (when done testing)

```bash
cd backend/cdk
npm run destroy:alpha
```

## Beta Stage - GitHub Auto-Deploy

Beta deploys automatically when you merge to `main`. You don't deploy it manually.

### How Beta Works

1. Merge PR to `main`
2. GitHub Actions triggers
3. Builds Lambda functions
4. Deploys to beta: `npm run deploy:beta`
5. Runs integration tests
6. If tests pass → triggers gamma deployment

### View Beta Resources

```bash
# From AWS Console
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --profile stackfolio-shiva \
  | grep beta

# Or visit CloudFormation console:
# https://console.aws.amazon.com/cloudformation
```

## Gamma Stage - Production

Gamma deploys automatically after beta tests pass. Manual deployment also possible for hotfixes.

### Manual Gamma Deploy (Emergency Only)

```bash
cd backend
npm run build

cd cdk
npm run deploy:gamma
```

## Resource Naming Convention

All resources follow this pattern:

```
stackfolio-{resource-type}-{stage}-{account-id}
```

Examples:
- `stackfolio-content-alpha-123456789`
- `stackfolio-html-generator-beta`
- `stackfolio-api-gamma`

### S3 Bucket Structure

```
stackfolio-content-{stage}-{account}/
├── users/
│   ├── user-123/
│   │   ├── context/          # Uploaded files
│   │   │   ├── resume.pdf
│   │   │   └── headshot.jpg
│   │   ├── generated/        # AI-generated HTML
│   │   │   ├── draft.html
│   │   │   └── live.html
│   │   └── metadata/
│   │       └── content-manifest.json
│   └── user-456/
│       └── ...
```

### Tagging Strategy

Every resource is tagged:
- `Project: Stackfolio`
- `Stage: alpha|beta|gamma`
- `ManagedBy: CDK`
- `Environment: production|non-production`

Find resources by tag:
```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Stage,Values=alpha \
  --profile stackfolio-shiva
```

## Troubleshooting

### "Stack already exists"

If you see this error, the stack exists but deployment failed. Try:

```bash
# Delete the stack
aws cloudformation delete-stack \
  --stack-name Stackfolio-Backend-alpha \
  --profile stackfolio-shiva

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name Stackfolio-Backend-alpha \
  --profile stackfolio-shiva

# Redeploy
npm run deploy:alpha
```

### Lambda function not found

Make sure you built the Lambda code:

```bash
cd backend
npm run build
ls -la dist/lambdas/  # Should see compiled JS
```

### Cognito user pool issues

Reset the user pool (alpha only):

```bash
# Delete stack (includes user pool)
npm run destroy:alpha

# Redeploy
npm run deploy:alpha
```

### S3 bucket already exists

Bucket names are global. If you get a conflict:

1. Choose a different account ID, or
2. Delete the existing bucket:
   ```bash
   aws s3 rb s3://stackfolio-content-alpha-123456789 \
     --force \
     --profile stackfolio-shiva
   ```

## Cost Management

### Alpha Costs (typical)
- Lambda: ~$0 (free tier)
- S3: ~$0.50/month (< 1GB)
- Bedrock: ~$0.01 per request
- CloudFront: ~$1/month
- **Total: ~$2-5/month**

### Destroy Alpha when not testing:
```bash
npm run destroy:alpha
```

### Beta/Gamma Costs
Monitor in AWS Cost Explorer, tag filter: `Stage=beta` or `Stage=gamma`

## Quick Reference

```bash
# Deploy alpha from Mac
cd backend/cdk && npm run deploy:alpha

# Check what will change
npm run diff:alpha

# View deployed resources
aws cloudformation describe-stacks --stack-name Stackfolio-Backend-alpha

# Destroy alpha
npm run destroy:alpha

# Force update all stacks
cdk deploy --all --context stage=alpha --force

# Get API endpoint
aws cloudformation describe-stacks \
  --stack-name Stackfolio-Backend-alpha \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

## Next Steps

1. ✅ Deploy alpha: `npm run deploy:alpha`
2. ✅ Test health endpoint
3. ✅ Upload a test PDF to S3
4. ✅ Check Lambda logs
5. ✅ Build frontend and connect to alpha API

---

**Questions?** Check logs in CloudWatch:
```bash
aws logs tail /aws/lambda/stackfolio-content-processor-alpha --follow
```
