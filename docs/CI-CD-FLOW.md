# CI/CD Pipeline Flow

## Fully Automated Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DEVELOPER WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────┘

  git push origin feature-branch
           ↓
  ┌────────────────┐
  │  Pull Request  │
  └────────┬───────┘
           ↓
  ┌────────────────────────────┐
  │  CI Checks (PR)            │
  │  • Lint                    │
  │  • Type Check              │
  │  • Unit Tests              │
  │  • Build Verification      │
  └────────┬───────────────────┘
           ↓
      ✅ Pass  ❌ Fail
           ↓         ↓
    Code Review   Fix & Push
           ↓
    Merge to main


┌─────────────────────────────────────────────────────────────────────┐
│                          BETA DEPLOYMENT                             │
└─────────────────────────────────────────────────────────────────────┘

  Merge to main (auto-trigger)
           ↓
  ┌────────────────────────────┐
  │  Backend CI/CD             │
  │  • npm ci                  │
  │  • npm run build           │
  │  • CDK deploy (beta)       │
  └────────┬───────────────────┘
           ↓
  ┌────────────────────────────┐
  │  Frontend CI/CD            │
  │  • npm ci                  │
  │  • npm run build           │
  │  • S3 sync (beta)          │
  │  • CloudFront invalidate   │
  └────────┬───────────────────┘
           ↓
  ┌────────────────────────────┐
  │  Integration Tests         │
  │  • Upload → Extract test   │
  │  • Chat → Edit test        │
  │  • Publish → HTML test     │
  │  • Auth flow test          │
  └────────┬───────────────────┘
           ↓
      ✅ Pass  ❌ Fail
           ↓         ↓
       Continue   ⛔ BLOCK PRODUCTION
                      ↓
                  Slack Alert
                  "Fix before prod"


┌─────────────────────────────────────────────────────────────────────┐
│                     PRODUCTION PROMOTION (AUTO)                      │
└─────────────────────────────────────────────────────────────────────┘

  Integration tests passed
           ↓
  ┌────────────────────────────┐
  │  Production Promotion      │
  │  Workflow Triggered        │
  └────────┬───────────────────┘
           ↓
  ┌──────────────────┬─────────────────┐
  │                  │                 │
  │  Deploy Backend  │  Deploy Frontend│
  │  to Production   │  to Production  │
  │                  │                 │
  └────────┬─────────┴─────────┬───────┘
           │                   │
           └─────────┬─────────┘
                     ↓
           ┌────────────────────────────┐
           │  Smoke Tests (Prod)        │
           │  • API health check        │
           │  • Frontend loads          │
           │  • CloudFront serving      │
           │  • Lambda cold start < 5s  │
           └────────┬───────────────────┘
                    ↓
               ✅ Pass  ❌ Fail
                    ↓         ↓
              Complete    AUTO-ROLLBACK
                    ↓         ↓
             Slack Notify  ┌──────────────────────┐
             "✅ Deployed" │  Rollback Workflow   │
                           │  • git checkout HEAD~1│
                           │  • Rebuild & redeploy│
                           │  • Slack alert       │
                           └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                          TIMELINE EXAMPLE                            │
└─────────────────────────────────────────────────────────────────────┘

  00:00  Developer merges PR to main
  00:01  Backend CI starts (lint, test, build)
  00:01  Frontend CI starts (lint, test, build)
  00:05  Backend deployed to beta
  00:05  Frontend deployed to beta
  00:06  Integration tests start
  00:15  Integration tests complete ✅
  00:15  Production promotion triggered
  00:16  Backend deploying to prod
  00:16  Frontend deploying to prod
  00:22  Smoke tests start
  00:23  Smoke tests complete ✅
  00:23  Deployment complete 🎉

  Total time: ~23 minutes (PR merge → production)


┌─────────────────────────────────────────────────────────────────────┐
│                        FAILURE SCENARIOS                             │
└─────────────────────────────────────────────────────────────────────┘

Scenario 1: Unit Tests Fail
  → PR blocked, no merge
  → No deployment triggered
  → Developer fixes and pushes

Scenario 2: Integration Tests Fail
  → Beta deployed (for debugging)
  → Production deployment BLOCKED
  → Slack alert: "Integration tests failed"
  → Team investigates beta environment
  → No rollback needed (prod untouched)

Scenario 3: Smoke Tests Fail (Production)
  → Production deployment completed
  → Smoke tests detect issue
  → AUTO-ROLLBACK triggered immediately
  → Previous version redeployed (~5 min)
  → Slack alert: "Rolled back to HEAD~1"
  → Team investigates failed commit offline

Scenario 4: CloudWatch Alarm (Post-Deploy)
  → Manual investigation required
  → Team decides: keep or rollback
  → Manual rollback procedure available


┌─────────────────────────────────────────────────────────────────────┐
│                        SAFETY GUARANTEES                             │
└─────────────────────────────────────────────────────────────────────┘

  ✅ No code reaches production without:
     • Passing unit tests
     • Passing integration tests in beta
     • Passing smoke tests in prod

  ✅ Failed deployments auto-rollback:
     • Automatic revert to last known good state
     • ~5-10 minute recovery time

  ✅ Beta environment is production-like:
     • Same infrastructure (CDK stacks)
     • Real AWS services (Bedrock, S3, Textract)
     • Integration tests catch issues early

  ✅ Slack notifications at every stage:
     • Integration test failures
     • Production deployments
     • Smoke test failures
     • Rollback executions
```

## Key Benefits of Auto-Promotion

1. **Faster Delivery**: Changes reach production in ~20 minutes vs hours/days
2. **Confidence Through Testing**: Comprehensive test gate before prod
3. **Safe Failures**: Auto-rollback means production stays stable
4. **Developer Velocity**: No waiting for manual approvals
5. **Predictable Process**: Same flow every time, no exceptions

## When to Use Manual Approval (Future)

Consider adding manual approval back for:
- Major version releases (v1 → v2)
- Database schema migrations
- Breaking API changes
- Security-sensitive updates

For now: **fully automated** gives best developer experience.
