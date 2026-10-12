# Pre-Deployment Checklist

## Before Running `./setup.sh`

### AWS Setup

- [ ] AWS account created
- [ ] AWS CLI installed (`brew install awscli`)
- [ ] AWS credentials configured for stackfolio-shiva profile:
  ```bash
  aws configure --profile stackfolio-shiva
  ```
- [ ] Profile exported:
  ```bash
  export AWS_PROFILE=stackfolio-shiva
  ```
- [ ] Credentials verified:
  ```bash
  aws sts get-caller-identity
  ```

### Local Environment

- [ ] Node.js 20+ installed (`node --version`)
- [ ] npm 10+ installed (`npm --version`)
- [ ] Git repository initialized
- [ ] In project directory: `cd ai-portfolio-platform`

### AWS Permissions Required

Your IAM user needs these permissions:
- [ ] CloudFormation (create/update/delete stacks)
- [ ] S3 (create buckets, upload objects)
- [ ] Lambda (create functions, update code)
- [ ] IAM (create roles, attach policies)
- [ ] API Gateway (create APIs, deploy stages)
- [ ] Cognito (create user pools)
- [ ] CloudFront (create distributions)
- [ ] Bedrock (invoke models)
- [ ] Textract (detect text)
- [ ] Rekognition (detect labels)

💡 **Tip**: Use `AdministratorAccess` policy for alpha testing, then restrict for production.

## Running Setup

```bash
./setup.sh
```

This will:
1. ✅ Verify AWS credentials
2. ✅ Check CDK bootstrap status
3. ✅ Install dependencies (root, backend, CDK)
4. ✅ Build Lambda functions
5. ✅ Optionally deploy to alpha

**Estimated time**: 5-10 minutes (first time)

## After Deployment

### Verify Backend

- [ ] CloudFormation stacks created:
  ```bash
  aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE
  ```
- [ ] API Gateway endpoint working:
  ```bash
  curl $(aws cloudformation describe-stacks \
    --stack-name Stackfolio-Backend-alpha \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text)/health
  ```
  Expected: `{"status":"healthy","stage":"alpha",...}`

- [ ] S3 buckets created:
  ```bash
  aws s3 ls | grep stackfolio
  ```
  Expected: `stackfolio-content-alpha-*`, `stackfolio-dashboard-alpha-*`, etc.

- [ ] Lambda functions deployed:
  ```bash
  aws lambda list-functions --query 'Functions[?contains(FunctionName, `stackfolio-alpha`)].FunctionName'
  ```

- [ ] Cognito user pool created:
  ```bash
  aws cognito-idp list-user-pools --max-results 10 | grep stackfolio
  ```

### Test Upload

- [ ] Create test user:
  ```bash
  BUCKET=$(aws cloudformation describe-stacks \
    --stack-name Stackfolio-Backend-alpha \
    --query 'Stacks[0].Outputs[?OutputKey==`ContentBucketName`].OutputValue' \
    --output text)
  
  aws s3 mb s3://$BUCKET/users/test-user-1/context/
  ```

- [ ] Upload test file:
  ```bash
  echo "Test resume content" > test-resume.txt
  aws s3 cp test-resume.txt s3://$BUCKET/users/test-user-1/context/resume.txt
  ```

- [ ] Check Lambda execution:
  ```bash
  aws logs tail /aws/lambda/stackfolio-content-processor-alpha --follow
  ```

- [ ] Verify manifest created:
  ```bash
  aws s3 ls s3://$BUCKET/users/test-user-1/metadata/
  ```
  Expected: `content-manifest.json`

### Get Configuration

- [ ] Save API endpoint:
  ```bash
  API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name Stackfolio-Backend-alpha \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text)
  
  echo "API_ENDPOINT=$API_ENDPOINT"
  ```

- [ ] Save User Pool ID:
  ```bash
  USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name Stackfolio-Backend-alpha \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)
  
  echo "USER_POOL_ID=$USER_POOL_ID"
  ```

- [ ] Save User Pool Client ID:
  ```bash
  CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name Stackfolio-Backend-alpha \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)
  
  echo "CLIENT_ID=$CLIENT_ID"
  ```

- [ ] Create `.env.alpha` file for frontend:
  ```bash
  cat > frontend/.env.alpha << EOF
  VITE_API_ENDPOINT=$API_ENDPOINT
  VITE_USER_POOL_ID=$USER_POOL_ID
  VITE_USER_POOL_CLIENT_ID=$CLIENT_ID
  VITE_STAGE=alpha
  EOF
  ```

## Common Issues

### "Stack already exists"

```bash
# Delete and retry
cd backend/cdk
npm run destroy:alpha
npm run deploy:alpha
```

### "Bucket already exists"

Bucket names are global. The script includes your account ID to make them unique.  
If still conflicts, check if bucket exists:

```bash
aws s3 ls | grep stackfolio
aws s3 rb s3://stackfolio-content-alpha-XXXXXX --force
```

### "CDK not bootstrapped"

```bash
cd backend/cdk
npx cdk bootstrap
```

### Lambda build fails

```bash
cd backend
rm -rf dist node_modules
npm install
npm run build
```

### CloudFormation stack stuck

```bash
# Delete stuck stack
aws cloudformation delete-stack --stack-name Stackfolio-Backend-alpha

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name Stackfolio-Backend-alpha

# Retry deployment
cd backend/cdk
npm run deploy:alpha
```

## Next Steps After Alpha Works

- [ ] Build frontend dashboard
- [ ] Connect frontend to alpha API
- [ ] Test file upload flow
- [ ] Test chat editing
- [ ] Test HTML generation
- [ ] Push to GitHub
- [ ] Verify beta auto-deployment
- [ ] Run integration tests
- [ ] Verify gamma promotion

## Cleanup (When Done Testing)

```bash
cd backend/cdk
npm run destroy:alpha
```

This removes all alpha resources and stops AWS charges.

---

## Ready? Run Setup Now 🚀

```bash
cd /Users/shivasrivastava/.kiro/crew/workspace/ai-portfolio-platform
./setup.sh
```
