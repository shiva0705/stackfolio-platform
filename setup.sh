#!/bin/bash

set -e

echo "🚀 Stackfolio CDK Setup Script"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    echo "Install with: brew install awscli"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI found${NC}"

# Check if AWS profile is configured
if [ -z "$AWS_PROFILE" ]; then
    echo -e "${YELLOW}⚠️  AWS_PROFILE not set${NC}"
    echo "Please set your profile:"
    echo "  export AWS_PROFILE=stackfolio-shiva"
    echo ""
    read -p "Enter AWS profile name (default: stackfolio-shiva): " PROFILE
    PROFILE=${PROFILE:-stackfolio-shiva}
    export AWS_PROFILE=$PROFILE
fi

echo -e "${GREEN}✅ Using AWS profile: $AWS_PROFILE${NC}"

# Verify credentials
echo ""
echo "Verifying AWS credentials..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>&1)
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Run: aws configure --profile $AWS_PROFILE"
    exit 1
fi

echo -e "${GREEN}✅ AWS Account: $ACCOUNT_ID${NC}"

# Get region
REGION=$(aws configure get region --profile $AWS_PROFILE)
REGION=${REGION:-us-east-1}
echo -e "${GREEN}✅ AWS Region: $REGION${NC}"

# Check if CDK is bootstrapped
echo ""
echo "Checking CDK bootstrap status..."
BOOTSTRAP_CHECK=$(aws cloudformation describe-stacks \
    --stack-name CDKToolkit \
    --profile $AWS_PROFILE \
    --region $REGION \
    2>&1 || echo "not-found")

if [[ $BOOTSTRAP_CHECK == *"not-found"* ]] || [[ $BOOTSTRAP_CHECK == *"does not exist"* ]]; then
    echo -e "${YELLOW}⚠️  CDK not bootstrapped in this account/region${NC}"
    echo ""
    read -p "Bootstrap CDK now? (y/n): " BOOTSTRAP
    if [ "$BOOTSTRAP" = "y" ]; then
        echo "Bootstrapping CDK..."
        cd backend/cdk
        npm install
        npx cdk bootstrap aws://$ACCOUNT_ID/$REGION --profile $AWS_PROFILE
        cd ../..
        echo -e "${GREEN}✅ CDK bootstrapped${NC}"
    else
        echo "Please bootstrap manually:"
        echo "  cd backend/cdk && npx cdk bootstrap"
        exit 1
    fi
else
    echo -e "${GREEN}✅ CDK already bootstrapped${NC}"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."

# Root
if [ -f "package.json" ]; then
    echo "Installing root dependencies..."
    npm install
fi

# Backend
echo "Installing backend dependencies..."
cd backend
npm install
cd ..

# CDK
echo "Installing CDK dependencies..."
cd backend/cdk
npm install
cd ../..

echo ""
echo -e "${GREEN}✅ All dependencies installed${NC}"

# Build backend
echo ""
echo "Building backend Lambda functions..."
cd backend
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

cd ..
echo -e "${GREEN}✅ Build successful${NC}"

# Ask about deployment
echo ""
echo "================================"
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Deploy to Alpha (your local test environment):"
echo -e "   ${YELLOW}cd backend/cdk && npm run deploy:alpha${NC}"
echo ""
echo "2. View deployed resources:"
echo -e "   ${YELLOW}aws cloudformation describe-stacks --stack-name Stackfolio-Backend-alpha${NC}"
echo ""
echo "3. Test the API:"
echo -e "   ${YELLOW}curl \$(aws cloudformation describe-stacks --stack-name Stackfolio-Backend-alpha --query 'Stacks[0].Outputs[?OutputKey==\`ApiEndpoint\`].OutputValue' --output text)/health${NC}"
echo ""
read -p "Deploy to Alpha now? (y/n): " DEPLOY

if [ "$DEPLOY" = "y" ]; then
    echo ""
    echo "🚀 Deploying to Alpha..."
    cd backend/cdk
    npm run deploy:alpha
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        echo ""
        echo "Get your API endpoint:"
        echo "  aws cloudformation describe-stacks \\"
        echo "    --stack-name Stackfolio-Backend-alpha \\"
        echo "    --query 'Stacks[0].Outputs'"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        echo "Check the error above and try again"
    fi
else
    echo ""
    echo "When ready, deploy with:"
    echo "  cd backend/cdk && npm run deploy:alpha"
fi
