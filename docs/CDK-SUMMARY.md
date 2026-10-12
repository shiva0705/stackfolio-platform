# Stackfolio CDK Infrastructure Summary

## ✅ Ready to Deploy

Your CDK infrastructure is **complete and ready** for alpha deployment.

## What's Been Created

### 1. CDK Stacks (`backend/cdk/`)

**Backend Stack** (`lib/backend-stack.ts`):
- ✅ S3 bucket for content storage (versioned, encrypted)
- ✅ Cognito User Pool for authentication
- ✅ 4 Lambda functions:
  - `content-processor` - Extracts text from PDFs/images
  - `html-generator` - Generates portfolio HTML
  - `chat-handler` - Conversational editing API
  - `publish-handler` - Publishes draft → live
- ✅ API Gateway with Cognito authorizer
- ✅ IAM roles with Bedrock, Textract, Rekognition permissions
- ✅ S3 event triggers for automatic processing

**Frontend Stack** (`lib/frontend-stack.ts`):
- ✅ S3 bucket for dashboard hosting
- ✅ S3 bucket for generated portfolios
- ✅ CloudFront distributions (dashboard + portfolios)
- ✅ Origin Access Identities for security
- ✅ Caching policies optimized for static content

### 2. Stage Separation

All resources clearly tagged and named by stage:

**Alpha** (your Mac):
```
stackfolio-content-alpha-{account-id}
stackfolio-html-generator-alpha
stackfolio-api-alpha
...
```

**Beta** (auto from GitHub):
```
stackfolio-content-beta-{account-id}
stackfolio-html-generator-beta
stackfolio-api-beta
...
```

**Gamma** (production):
```
stackfolio-content-gamma-{account-id}
stackfolio-html-generator-gamma
stackfolio-api-gamma
...
```

### 3. Deployment Scripts

**Setup Script** (`setup.sh`):
- Verifies AWS credentials
- Bootstraps CDK if needed
- Installs all dependencies
- Builds Lambda functions
- Optionally deploys to alpha

**Package Scripts** (`backend/cdk/package.json`):
```bash
npm run deploy:alpha   # Deploy to your test environment
npm run deploy:beta    # (Used by GitHub Actions)
npm run deploy:gamma   # (Used by GitHub Actions or emergency)
npm run diff:alpha     # Preview changes before deploy
npm run destroy:alpha  # Clean up when done testing
```

### 4. Resource Tags

Every resource tagged for easy management:
```json
{
  "Project": "Stackfolio",
  "Stage": "alpha|beta|gamma",
  "ManagedBy": "CDK",
  "Environment": "production|non-production"
}
```

Find all alpha resources:
```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Stage,Values=alpha
```

## S3 Bucket Organization

### Content Bucket
```
stackfolio-content-{stage}-{account}/
└── users/
    └── {userId}/
        ├── context/                    # User uploads
        │   ├── resume.pdf             # Original files
        │   ├── headshot.jpg
        │   └── awards.txt
        ├── generated/                  # AI-generated HTML
        │   ├── draft.html             # Latest draft
        │   ├── live.html              # Published version
        │   └── versions/              # History (last 5)
        │       ├── v1.html
        │       └── v2.html
        └── metadata/
            └── content-manifest.json   # Structured data
```

### Dashboard Bucket
```
stackfolio-dashboard-{stage}-{account}/
├── index.html                         # React app
├── assets/
│   ├── index-abc123.js               # Hashed for caching
│   └── index-def456.css
└── ...
```

### Portfolio Bucket
```
stackfolio-portfolios-{stage}-{account}/
├── {userId1}/
│   └── index.html                     # Published portfolio
├── {userId2}/
│   └── index.html
└── ...
```

## API Endpoints

After deployment, you'll get:

```
https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/alpha/
├── GET  /health                       # No auth
├── POST /chat                         # Cognito auth
├── POST /publish                      # Cognito auth
└── GET  /users/{userId}/preview       # Cognito auth
```

## CloudFront URLs

```
Dashboard: https://xxxxxxxxxx.cloudfront.net
Portfolios: https://yyyyyyyyyy.cloudfront.net
```

## Lambda Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `content-processor` | S3 upload | Extracts text → Bedrock classifies → updates manifest |
| `html-generator` | API call | Loads manifest → Bedrock generates HTML → saves to S3 |
| `chat-handler` | API POST | User message → Bedrock intent → updates manifest → regenerates HTML |
| `publish-handler` | API POST | Copies draft.html → live.html → invalidates CloudFront |

## IAM Permissions

Lambda execution role has access to:
- ✅ S3 (read/write content bucket)
- ✅ Bedrock (Claude 3.5 Sonnet, Claude 3 Haiku)
- ✅ Textract (PDF text extraction)
- ✅ Rekognition (image analysis)
- ✅ CloudWatch Logs (function logs)
- ✅ Lambda Invoke (chat → html-generator)

## Cost Estimates

### Alpha (per month, light usage):
- Lambda: $0 (free tier)
- S3: $0.50 (< 1GB)
- Bedrock: $2-5 (testing)
- CloudFront: $1
- **Total: ~$3-7/month**

### Beta/Gamma:
Monitor with AWS Cost Explorer, filter by `Stage` tag.

## Deployment Safety

✅ **Alpha resources auto-delete** when you run `npm run destroy:alpha`  
✅ **Beta/Gamma resources retained** (set `removalPolicy: RETAIN`)  
✅ **S3 versioning enabled** for rollback  
✅ **CloudWatch logs** for debugging  
✅ **Cognito email verification** prevents spam signups

## Next Steps

### 1. Deploy Alpha

```bash
cd /Users/shivasrivastava/.kiro/crew/workspace/ai-portfolio-platform
./setup.sh
```

### 2. Test the Stack

```bash
# Get outputs
aws cloudformation describe-stacks \
  --stack-name Stackfolio-Backend-alpha \
  --query 'Stacks[0].Outputs'

# Health check
API=$(aws cloudformation describe-stacks \
  --stack-name Stackfolio-Backend-alpha \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

curl $API/health
```

### 3. Upload a Test File

```bash
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name Stackfolio-Backend-alpha \
  --query 'Stacks[0].Outputs[?OutputKey==`ContentBucketName`].OutputValue' \
  --output text)

# Upload test resume
aws s3 cp test-resume.pdf s3://$BUCKET/users/test-user-1/context/resume.pdf

# Check Lambda logs
aws logs tail /aws/lambda/stackfolio-content-processor-alpha --follow
```

### 4. Build Frontend

After backend is deployed, build the React dashboard with the API endpoint.

## Troubleshooting

### CDK Bootstrap Required

```bash
cd backend/cdk
npx cdk bootstrap
```

### Stack Already Exists

```bash
# Delete and redeploy
npm run destroy:alpha
npm run deploy:alpha
```

### Lambda Not Found

```bash
# Make sure you built
cd backend
npm run build
ls -la dist/lambdas/
```

### View Logs

```bash
aws logs tail /aws/lambda/stackfolio-content-processor-alpha --follow
aws logs tail /aws/lambda/stackfolio-html-generator-alpha --follow
```

## Clean Separation Between Stages

✅ **No resource name conflicts** - Each stage has unique names  
✅ **No cross-stage pollution** - Uploads to alpha don't affect beta  
✅ **Easy cleanup** - Destroy alpha without touching beta/gamma  
✅ **Clear cost attribution** - Filter AWS Cost Explorer by `Stage` tag

---

## Ready to Deploy? 🚀

Run this now:

```bash
./setup.sh
```

This will walk you through:
1. Verifying AWS credentials
2. Bootstrapping CDK (if needed)
3. Installing dependencies
4. Building Lambda functions
5. Deploying to alpha

**Estimated time**: 5-10 minutes

---

**Questions?** Check the [detailed deployment guide](DEPLOY.md).
