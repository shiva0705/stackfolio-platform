# AI Portfolio Platform

> **An AI-first portfolio builder where users upload context and chat with AI to create and maintain their professional presence—no manual editing required.**

## Quick Start

### One-Command Setup

```bash
# First-time setup (installs dependencies, builds, optionally deploys)
./setup.sh
```

### Manual Deployment

```bash
# Deploy to Alpha (your local test environment)
cd backend/cdk
npm run deploy:alpha

# Deploy to Beta (via GitHub Actions on merge to main)
# Automatic - just merge your PR

# Deploy to Gamma (via GitHub Actions after beta tests pass)
# Automatic - or manual: npm run deploy:gamma
```

### Get Your API Endpoint

```bash
aws cloudformation describe-stacks \
  --stack-name Stackfolio-Backend-alpha \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

### Test Health Endpoint

```bash
curl $(aws cloudformation describe-stacks \
  --stack-name Stackfolio-Backend-alpha \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)/health
```

## Deployment Stages

| Stage | Purpose | Deploy Method | Resources |
|-------|---------|---------------|-----------|
| **Alpha** | Local development | `npm run deploy:alpha` | `stackfolio-*-alpha-*` |
| **Beta** | Staging | Auto on `git push main` | `stackfolio-*-beta-*` |
| **Gamma** | Production | Auto after beta tests | `stackfolio-*-gamma-*` |

📖 **Detailed Guide**: See [DEPLOY.md](docs/DEPLOY.md)

## What Makes This Different

**Traditional Portfolio Builders:**
- User fills out forms
- Clicks and drags to edit
- Uploads images one by one
- Manual updates required

**AI Portfolio Platform:**
- User uploads bulk context (resume, photos, awards PDFs)
- AI extracts and structures everything
- User chats: "Make my headline more executive-focused"
- AI updates and publishes
- **Zero manual editing**

## Project Structure

```
ai-portfolio-platform/
├── backend/
│   ├── lambdas/
│   │   ├── content-processor/    # Extracts content from uploads
│   │   ├── html-generator/       # Generates HTML from manifest
│   │   ├── chat-handler/         # AI conversation endpoint
│   │   └── publish-handler/      # Publishes draft → live
│   └── shared/                   # Shared utilities
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Upload/          # Drag & drop interface
│   │   │   ├── Chat/            # AI chat interface
│   │   │   └── Preview/         # Live preview frame
│   │   └── App.tsx
│   └── package.json
├── infrastructure/
│   ├── lib/                     # AWS CDK stacks
│   │   ├── storage-stack.ts    # S3, CloudFront
│   │   ├── compute-stack.ts    # Lambda functions
│   │   └── api-stack.ts        # API Gateway
│   └── cdk.json
└── docs/
    ├── ARCHITECTURE.md          # System design
    ├── API.md                   # API documentation
    └── DEPLOYMENT.md            # Deployment guide
```

## Core Workflow

### 1. Upload Context
```typescript
// User drags resume.pdf + headshot.jpg
// Files upload directly to S3
// Lambda extracts and classifies content
```

### 2. AI Processing
```typescript
// Bedrock Claude reads resume PDF
// Extracts: experience, education, awards, skills
// Classifies into structured manifest.json
// Generates initial HTML portfolio
```

### 3. Conversational Editing
```typescript
User: "Add my recent Order of the Palmetto award"
AI: "I've added the Order of the Palmetto to your awards section. 
     Preview: [link]"

User: "Make the bio more concise"
AI: "I've shortened your bio to 2 paragraphs, focusing on your 
     healthcare leadership. Preview: [link]"

User: "Publish it"
AI: "Published! Your portfolio is live at seema-shrivastava.com"
```

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: AWS Lambda (Node.js 20), API Gateway
- **AI**: AWS Bedrock (Claude 3.5 Sonnet, Claude 3 Haiku)
- **Storage**: S3, CloudFront (global CDN)
- **Auth**: AWS Cognito
- **IaC**: AWS CDK (TypeScript)

## Key Features

✅ **Drag & Drop Upload** - Bulk upload images, PDFs, documents  
✅ **AI Content Extraction** - Textract + Bedrock parse and classify  
✅ **Conversational Editing** - Natural language updates  
✅ **Instant Preview** - See changes before publishing  
✅ **One-Click Publish** - Live in < 30 seconds  
✅ **Custom Domains** - Your domain, your brand  
✅ **Pure HTML Output** - 7x faster than React apps  
✅ **Global CDN** - CloudFront edge serving  

## Development Status

**Current Phase**: Backend Foundation  
**Started**: October 12, 2026  
**Target Completion**: November 1, 2026

### Milestones

- [x] Architecture design
- [ ] S3 + Lambda setup
- [ ] Bedrock integration
- [ ] Content processor
- [ ] HTML generator
- [ ] Chat handler
- [ ] Frontend dashboard
- [ ] CloudFront distribution
- [ ] Custom domain support
- [ ] User testing

## Environment Variables

```bash
# AWS
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=<your-account-id>

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# S3
CONTENT_BUCKET=portfolio-platform-content
CLOUDFRONT_DISTRIBUTION_ID=<distribution-id>

# API
API_GATEWAY_URL=<api-url>

# Auth
COGNITO_USER_POOL_ID=<pool-id>
COGNITO_CLIENT_ID=<client-id>
```

## Local Development

### Backend (Lambda functions locally)

```bash
cd backend
npm install
npm run build
sam local start-api  # Requires AWS SAM CLI
```

### Frontend

```bash
cd frontend
npm install
npm run dev  # Opens http://localhost:5173
```

## Deployment

```bash
# Deploy infrastructure
cd infrastructure
npm run cdk:deploy

# Deploy Lambda functions
cd ../backend
npm run deploy

# Build and deploy frontend
cd ../frontend
npm run build
aws s3 sync dist/ s3://portfolio-platform-dashboard
```

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests (Playwright)
npm run test:e2e
```

## Cost Estimate

**Per Portfolio (Monthly):**
- S3 storage: $0.50
- CloudFront: $1.00
- Lambda: $0.50
- Bedrock: $2.00
- **Total: ~$4/month**

**For 100 portfolios: ~$400/month**

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Content Manifest Schema](./docs/MANIFEST_SCHEMA.md)
- [HTML Generation Guide](./docs/HTML_GENERATION.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Contact

- Project Lead: Shiva Srivastava
- Email: shiva@example.com
- Started: October 2026
