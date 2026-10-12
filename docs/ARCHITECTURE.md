# AI Portfolio Platform - Architecture Document

**Version**: 2.0  
**Date**: October 12, 2026  
**Status**: Active Development

---

## Vision

An AI-first portfolio platform where users upload context (images, PDFs, documents) and converse with AI to build and maintain their professional portfolio. No manual clicking, dragging, or traditional editing—just natural language conversation.

---

## Core Principles

1. **Context-Driven**: User uploads raw materials (resume, photos, awards), AI extracts and structures
2. **Conversational Editing**: All changes happen through natural language chat
3. **Zero Runtime Overhead**: Portfolios are pure HTML served from CloudFront edge locations
4. **Instant Publishing**: Changes go live in < 30 seconds via CloudFront cache invalidation
5. **Serverless-First**: AWS Lambda + Bedrock, no servers to manage

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Dashboard                           │
│  - Upload interface (drag & drop)                          │
│  - AI chat interface                                        │
│  - Preview frame                                            │
│  - Publish button                                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                API Gateway (REST)                           │
│  POST /upload-url  → Generate S3 presigned URL             │
│  POST /chat        → AI conversation endpoint               │
│  POST /publish     → Publish draft to live                 │
│  GET  /preview     → Get draft preview URL                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              AWS Lambda Functions                           │
│  1. content-processor  (S3 trigger)                        │
│  2. html-generator     (on-demand)                         │
│  3. chat-handler       (API Gateway)                       │
│  4. publish-handler    (API Gateway)                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Amazon Bedrock                            │
│  - Claude 3.5 Sonnet (HTML generation)                     │
│  - Claude 3 Haiku (chat, classification)                   │
└─────────────────────────────────────────────────────────────┘
                 
┌─────────────────────────────────────────────────────────────┐
│                      S3 Buckets                             │
│  portfolio-content/                                         │
│    users/{userId}/                                          │
│      context/       # User uploads                          │
│      generated/     # AI-generated HTML                     │
│      metadata/      # Content manifest                      │
└─────────────────────────────────────────────────────────────┘
                 
┌─────────────────────────────────────────────────────────────┐
│              CloudFront Distribution                        │
│  - Serves generated HTML                                    │
│  - Custom domain support                                    │
│  - Global edge caching                                      │
│  - SSL/HTTPS automatic                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### **Upload Flow:**
1. User drags file to dashboard
2. Frontend requests presigned S3 URL from API
3. File uploads directly to S3 (no backend involvement)
4. S3 triggers `content-processor` Lambda
5. Lambda extracts text/metadata (Textract for PDFs, Rekognition for images)
6. Bedrock classifies content into structured manifest
7. Manifest saved to S3 `metadata/content-manifest.json`
8. HTML auto-regenerated if enough context exists

### **Chat Flow:**
1. User types message: "Make my headline emphasize healthcare"
2. Frontend sends to `/chat` endpoint
3. `chat-handler` Lambda loads current manifest
4. Bedrock determines intent and generates update
5. Manifest updated, HTML regenerated as draft
6. Preview URL returned to user
7. User sees changes in preview iframe

### **Publish Flow:**
1. User clicks "Publish"
2. `publish-handler` copies draft HTML → live HTML
3. CloudFront cache invalidation triggered
4. Live site updated globally in ~30 seconds

---

## Content Manifest Schema

```json
{
  "userId": "seema-shrivastava",
  "version": "1.0.0",
  "lastUpdated": "2026-10-12T21:23:00Z",
  "profile": {
    "name": "Seema Shrivastava-Patel",
    "headline": "CEO, Board Chair, Community Leader",
    "tagline": "Building healthier communities through healthcare innovation",
    "photo": {
      "url": "s3://bucket/users/seema/context/headshot.jpg",
      "alt": "Professional headshot of Seema Shrivastava-Patel"
    }
  },
  "about": {
    "summary": "A native of Columbia, South Carolina...",
    "highlights": [
      "First Indian American woman to serve as DHEC Chair",
      "CEO of Columbia Health with facilities in TX and SC"
    ],
    "sourceFiles": ["resume.pdf"]
  },
  "experience": [
    {
      "id": "exp-1",
      "role": "CEO",
      "company": "Columbia Health",
      "period": "2017 - Present",
      "current": true,
      "description": "Leading compounding pharmaceutical facilities...",
      "achievements": [],
      "sourceFiles": ["resume.pdf"]
    }
  ],
  "awards": [
    {
      "id": "award-1",
      "title": "Order of the Palmetto",
      "issuer": "State of South Carolina",
      "date": "2024",
      "description": "South Carolina's highest civilian honor...",
      "sourceFiles": ["awards.pdf"]
    }
  ],
  "boards": [],
  "philanthropy": {},
  "media": [],
  "contact": {
    "email": null,
    "phone": null,
    "linkedin": "https://linkedin.com/in/seema-shrivastava-patel-919a97142",
    "twitter": null,
    "instagram": null
  },
  "template": {
    "name": "professional-executive",
    "colorScheme": {
      "primary": "#0C2340",
      "accent": "#8B9DC3",
      "background": "#FFFFFF"
    },
    "sections": [
      "hero",
      "about",
      "experience",
      "awards",
      "boards",
      "philanthropy",
      "contact"
    ]
  },
  "metadata": {
    "createdAt": "2026-10-12T20:00:00Z",
    "publishedAt": null,
    "draftVersion": 1,
    "liveVersion": 0
  }
}
```

---

## HTML Generation Strategy

### **Bedrock Prompt Structure:**

```
System: You are an expert web developer creating professional portfolio websites.
You MUST generate complete, valid HTML5 documents that are:
- Semantic and accessible (WCAG 2.1 AA)
- Mobile-responsive (CSS media queries)
- Fast-loading (inline critical CSS, defer non-critical)
- SEO-optimized (meta tags, Open Graph, Schema.org)

User: Generate a professional portfolio HTML page with this content:

{content_manifest}

Design constraints:
- Template: {template_name}
- Color scheme: {colors}
- Sections in order: {section_order}
- Must include: {required_sections}

Output ONLY the complete HTML document. No explanations.
```

### **HTML Template Guardrails:**

```typescript
interface HTMLGenerationConstraints {
  maxFileSize: 500; // KB
  requiredMetaTags: string[];
  requiredSections: string[];
  colorScheme: ColorScheme;
  typography: Typography;
  accessibility: {
    minContrast: 4.5;
    requireAltText: true;
    requireAriaLabels: true;
  };
  performance: {
    inlineCSS: true;
    lazyLoadImages: true;
    noExternalScripts: true; // Except analytics
  };
}
```

---

## Technology Stack

### **Frontend (Dashboard)**
- React 18 + TypeScript
- Vite
- AWS Amplify (Auth)
- React Dropzone (file upload)
- TailwindCSS

### **Backend (Serverless)**
- AWS Lambda (Node.js 20)
- API Gateway (REST)
- AWS Bedrock (Claude models)
- AWS Textract (PDF text extraction)
- AWS Rekognition (image analysis)

### **Infrastructure**
- S3 (content storage)
- CloudFront (CDN)
- Route 53 (DNS)
- ACM (SSL certificates)
- Cognito (authentication)

### **Deployment**
- AWS CDK (Infrastructure as Code)
- GitHub Actions (CI/CD)

---

## Security Model

### **Authentication & Authorization:**
- Cognito User Pools for dashboard login
- Portfolio pages are PUBLIC (no auth required to view)
- Chat interface only visible to authenticated owner
- S3 presigned URLs expire in 5 minutes
- API Gateway JWT validation

### **Content Security:**
- S3 bucket NOT public (CloudFront OAI for access)
- Lambda execution roles follow least privilege
- No user-uploaded scripts executed
- HTML sanitization before serving

---

## Deployment Phases

### **Phase 1: Backend Foundation (Week 1)**
- [ ] S3 bucket structure
- [ ] Lambda: content-processor
- [ ] Lambda: html-generator
- [ ] Bedrock integration
- [ ] API Gateway setup
- [ ] Basic HTML generation working

### **Phase 2: Dashboard UI (Week 2)**
- [ ] Upload interface
- [ ] AI chat interface
- [ ] Preview frame
- [ ] Publish workflow
- [ ] Authentication (Cognito)

### **Phase 3: CloudFront & DNS (Week 2)**
- [ ] CloudFront distribution
- [ ] Custom domain support
- [ ] SSL certificates
- [ ] Cache invalidation

### **Phase 4: Polish & Testing (Week 3)**
- [ ] Error handling
- [ ] Version history
- [ ] Rollback capability
- [ ] Analytics integration
- [ ] Performance optimization
- [ ] User testing

---

## Success Metrics

### **Technical:**
- Page load time: < 200ms (CloudFront edge)
- HTML generation time: < 5 seconds
- Chat response time: < 2 seconds
- Publish time: < 30 seconds

### **User Experience:**
- Time to first portfolio: < 10 minutes
- AI chat accuracy: > 90% intent recognition
- User satisfaction: > 4.5/5 stars

---

## Cost Model

### **Per Portfolio (Monthly):**
- S3 storage: $0.50
- CloudFront bandwidth: $1.00
- Lambda executions: $0.50
- Bedrock API calls: $2.00
- **Total: ~$4/month per active portfolio**

### **Pricing Strategy:**
- Free: 1 portfolio, platform subdomain
- Pro ($15/month): Custom domain, unlimited edits, priority support
- Agency ($99/month): 20 portfolios, white-label, API access

---

## Future Enhancements

### **Phase 2 Features:**
- Multi-page sites (blog, case studies)
- Custom templates (user-designed)
- A/B testing capability
- Analytics dashboard
- Collaboration (multiple editors)
- Version branching

### **Phase 3 Features:**
- Video integration
- Interactive elements (contact forms)
- E-commerce (Stripe integration)
- Multi-language support
- API for programmatic updates

---

## References

- AWS Bedrock Documentation: https://docs.aws.amazon.com/bedrock/
- Claude API Guide: https://docs.anthropic.com/claude/docs
- CloudFront Developer Guide: https://docs.aws.amazon.com/cloudfront/
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
