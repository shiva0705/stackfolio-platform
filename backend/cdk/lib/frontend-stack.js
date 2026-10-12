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
exports.StackfolioFrontendStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
class StackfolioFrontendStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage, apiEndpoint, userPoolId, userPoolClientId } = props;
        // ========================================
        // S3 BUCKET - Dashboard Hosting
        // ========================================
        this.dashboardBucket = new s3.Bucket(this, 'DashboardBucket', {
            bucketName: `stackfolio-dashboard-${stage}-${this.account}`,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html', // SPA routing
            publicReadAccess: false, // CloudFront will access via OAI
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: stage === 'alpha' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: stage === 'alpha',
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
        });
        cdk.Tags.of(this.dashboardBucket).add('Stage', stage);
        cdk.Tags.of(this.dashboardBucket).add('Purpose', 'Dashboard frontend hosting');
        // ========================================
        // S3 BUCKET - Generated Portfolio Pages
        // ========================================
        const portfolioBucket = new s3.Bucket(this, 'PortfolioBucket', {
            bucketName: `stackfolio-portfolios-${stage}-${this.account}`,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: stage === 'alpha' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: stage === 'alpha',
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
            lifecycleRules: [
                {
                    id: 'DeleteOldDrafts',
                    prefix: 'drafts/',
                    enabled: true,
                    expiration: cdk.Duration.days(30),
                },
            ],
        });
        cdk.Tags.of(portfolioBucket).add('Stage', stage);
        cdk.Tags.of(portfolioBucket).add('Purpose', 'Generated portfolio HTML storage');
        // ========================================
        // CLOUDFRONT - Dashboard Distribution
        // ========================================
        const dashboardOai = new cloudfront.OriginAccessIdentity(this, 'DashboardOAI', {
            comment: `Access identity for Stackfolio dashboard (${stage})`,
        });
        this.dashboardBucket.grantRead(dashboardOai);
        const dashboardDistribution = new cloudfront.Distribution(this, 'DashboardDistribution', {
            comment: `Stackfolio Dashboard - ${stage}`,
            defaultBehavior: {
                origin: new origins.S3Origin(this.dashboardBucket, {
                    originAccessIdentity: dashboardOai,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                compress: true,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.seconds(10),
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.seconds(10),
                },
            ],
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
            enabled: true,
        });
        // ========================================
        // CLOUDFRONT - Portfolio Distribution
        // ========================================
        const portfolioOai = new cloudfront.OriginAccessIdentity(this, 'PortfolioOAI', {
            comment: `Access identity for Stackfolio portfolios (${stage})`,
        });
        portfolioBucket.grantRead(portfolioOai);
        const portfolioDistribution = new cloudfront.Distribution(this, 'PortfolioDistribution', {
            comment: `Stackfolio Portfolios - ${stage}`,
            defaultBehavior: {
                origin: new origins.S3Origin(portfolioBucket, {
                    originAccessIdentity: portfolioOai,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachePolicy: new cloudfront.CachePolicy(this, 'PortfolioCachePolicy', {
                    cachePolicyName: `stackfolio-portfolio-cache-${stage}`,
                    comment: 'Cache policy for portfolio pages',
                    defaultTtl: cdk.Duration.hours(24),
                    maxTtl: cdk.Duration.days(365),
                    minTtl: cdk.Duration.seconds(0),
                    enableAcceptEncodingGzip: true,
                    enableAcceptEncodingBrotli: true,
                }),
                compress: true,
            },
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            enabled: true,
        });
        this.distributionDomainName = dashboardDistribution.distributionDomainName;
        // ========================================
        // OUTPUTS
        // ========================================
        new cdk.CfnOutput(this, 'DashboardUrl', {
            value: `https://${dashboardDistribution.distributionDomainName}`,
            description: 'Dashboard URL',
            exportName: `Stackfolio-DashboardUrl-${stage}`,
        });
        new cdk.CfnOutput(this, 'DashboardDistributionId', {
            value: dashboardDistribution.distributionId,
            description: 'Dashboard CloudFront Distribution ID',
            exportName: `Stackfolio-DashboardDistId-${stage}`,
        });
        new cdk.CfnOutput(this, 'PortfolioUrl', {
            value: `https://${portfolioDistribution.distributionDomainName}`,
            description: 'Portfolio pages URL',
            exportName: `Stackfolio-PortfolioUrl-${stage}`,
        });
        new cdk.CfnOutput(this, 'PortfolioDistributionId', {
            value: portfolioDistribution.distributionId,
            description: 'Portfolio CloudFront Distribution ID',
            exportName: `Stackfolio-PortfolioDistId-${stage}`,
        });
        new cdk.CfnOutput(this, 'DashboardBucketName', {
            value: this.dashboardBucket.bucketName,
            description: 'Dashboard S3 bucket name',
            exportName: `Stackfolio-DashboardBucket-${stage}`,
        });
        new cdk.CfnOutput(this, 'PortfolioBucketName', {
            value: portfolioBucket.bucketName,
            description: 'Portfolio pages S3 bucket name',
            exportName: `Stackfolio-PortfolioBucket-${stage}`,
        });
        new cdk.CfnOutput(this, 'ConfigSummary', {
            value: JSON.stringify({
                stage,
                apiEndpoint,
                userPoolId,
                userPoolClientId,
                dashboardUrl: `https://${dashboardDistribution.distributionDomainName}`,
                portfolioUrl: `https://${portfolioDistribution.distributionDomainName}`,
            }),
            description: 'Complete configuration for frontend .env file',
        });
    }
}
exports.StackfolioFrontendStack = StackfolioFrontendStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJvbnRlbmQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmcm9udGVuZC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFXOUQsTUFBYSx1QkFBd0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUlwRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW1DO1FBQzNFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUVuRSwyQ0FBMkM7UUFDM0MsZ0NBQWdDO1FBQ2hDLDJDQUEyQztRQUMzQyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDNUQsVUFBVSxFQUFFLHdCQUF3QixLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUMzRCxvQkFBb0IsRUFBRSxZQUFZO1lBQ2xDLG9CQUFvQixFQUFFLFlBQVksRUFBRSxjQUFjO1lBQ2xELGdCQUFnQixFQUFFLEtBQUssRUFBRSxpQ0FBaUM7WUFDMUQsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsYUFBYSxFQUFFLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07WUFDdkYsaUJBQWlCLEVBQUUsS0FBSyxLQUFLLE9BQU87WUFDcEMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1lBQzFDLFNBQVMsRUFB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V0FBVyxFQUFFLHNDQUFzQztZQUNuRCxVQUFVLEVBQUUsOEJBQThCLEtBQUssRUFBRTtTQUNsRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVU7WUFDdEMsV0FBVyxFQUFFLDBCQUEwQjtZQUN2QyxVQUFVLEVBQUUsOEJBQThCLEtBQUssRUFBRTtTQUNsRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxlQUFlLENBQUMsVUFBVTtZQUNqQyxXQUFXLEVBQUUsZ0NBQWdDO1lBQzdDLFVBQVUsRUFBRSw4QkFBOEIsS0FBSyxFQUFFO1NBQ2xELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNwQixLQUFLO2dCQUNMLFdBQVc7Z0JBQ1gsVUFBVTtnQkFDVixnQkFBZ0I7Z0JBQ2hCLFlBQVksRUFBRSxXQUFXLHFCQUFxQixDQUFDLHNCQUFzQixFQUFFO2dCQUN2RSxZQUFZLEVBQUUsV0FBVyxxQkFBcUIsQ0FBQyxzQkFBc0IsRUFBRTthQUN4RSxDQUFDO1lBQ0YsV0FBVyxFQUFFLCtDQUErQztTQUM3RCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEvS0QsMERBK0tDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBzM2RlcGxveSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtZGVwbG95bWVudCc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBTdGFja2ZvbGlvRnJvbnRlbmRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xuICBhcGlFbmRwb2ludDogc3RyaW5nO1xuICB1c2VyUG9vbElkOiBzdHJpbmc7XG4gIHVzZXJQb29sQ2xpZW50SWQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFN0YWNrZm9saW9Gcm9udGVuZFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRpc3RyaWJ1dGlvbkRvbWFpbk5hbWU6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGRhc2hib2FyZEJ1Y2tldDogczMuQnVja2V0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdGFja2ZvbGlvRnJvbnRlbmRTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHN0YWdlLCBhcGlFbmRwb2ludCwgdXNlclBvb2xJZCwgdXNlclBvb2xDbGllbnRJZCB9ID0gcHJvcHM7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUzMgQlVDS0VUIC0gRGFzaGJvYXJkIEhvc3RpbmdcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5kYXNoYm9hcmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdEYXNoYm9hcmRCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgc3RhY2tmb2xpby1kYXNoYm9hcmQtJHtzdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogJ2luZGV4Lmh0bWwnLCAvLyBTUEEgcm91dGluZ1xuICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsIC8vIENsb3VkRnJvbnQgd2lsbCBhY2Nlc3MgdmlhIE9BSVxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAnYWxwaGEnID8gY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSA6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBzdGFnZSA9PT0gJ2FscGhhJyxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMuZGFzaGJvYXJkQnVja2V0KS5hZGQoJ1N0YWdlJywgc3RhZ2UpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMuZGFzaGJvYXJkQnVja2V0KS5hZGQoJ1B1cnBvc2UnLCAnRGFzaGJvYXJkIGZyb250ZW5kIGhvc3RpbmcnKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTMyBCVUNLRVQgLSBHZW5lcmF0ZWQgUG9ydGZvbGlvIFBhZ2VzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IHBvcnRmb2xpb0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1BvcnRmb2xpb0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBzdGFja2ZvbGlvLXBvcnRmb2xpb3MtJHtzdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAnYWxwaGEnID8gY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSA6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBzdGFnZSA9PT0gJ2FscGhhJyxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZU9sZERyYWZ0cycsXG4gICAgICAgICAgcHJlZml4OiAnZHJhZnRzLycsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY2RrLlRhZ3Mub2YocG9ydGZvbGlvQnVja2V0KS5hZGQoJ1N0YWdlJywgc3RhZ2UpO1xuICAgIGNkay5UYWdzLm9mKHBvcnRmb2xpb0J1Y2tldCkuYWRkKCdQdXJwb3NlJywgJ0dlbmVyYXRlZCBwb3J0Zm9saW8gSFRNTCBzdG9yYWdlJyk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ0xPVURGUk9OVCAtIERhc2hib2FyZCBEaXN0cmlidXRpb25cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3QgZGFzaGJvYXJkT2FpID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkodGhpcywgJ0Rhc2hib2FyZE9BSScsIHtcbiAgICAgIGNvbW1lbnQ6IGBBY2Nlc3MgaWRlbnRpdHkgZm9yIFN0YWNrZm9saW8gZGFzaGJvYXJkICgke3N0YWdlfSlgLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kYXNoYm9hcmRCdWNrZXQuZ3JhbnRSZWFkKGRhc2hib2FyZE9haSk7XG5cbiAgICBjb25zdCBkYXNoYm9hcmREaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Rhc2hib2FyZERpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGNvbW1lbnQ6IGBTdGFja2ZvbGlvIERhc2hib2FyZCAtICR7c3RhZ2V9YCxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuZGFzaGJvYXJkQnVja2V0LCB7XG4gICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IGRhc2hib2FyZE9haSxcbiAgICAgICAgfSksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHByaWNlQ2xhc3M6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18xMDAsIC8vIFVTLCBDYW5hZGEsIEV1cm9wZVxuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDTE9VREZST05UIC0gUG9ydGZvbGlvIERpc3RyaWJ1dGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBwb3J0Zm9saW9PYWkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCAnUG9ydGZvbGlvT0FJJywge1xuICAgICAgY29tbWVudDogYEFjY2VzcyBpZGVudGl0eSBmb3IgU3RhY2tmb2xpbyBwb3J0Zm9saW9zICgke3N0YWdlfSlgLFxuICAgIH0pO1xuXG4gICAgcG9ydGZvbGlvQnVja2V0LmdyYW50UmVhZChwb3J0Zm9saW9PYWkpO1xuXG4gICAgY29uc3QgcG9ydGZvbGlvRGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdQb3J0Zm9saW9EaXN0cmlidXRpb24nLCB7XG4gICAgICBjb21tZW50OiBgU3RhY2tmb2xpbyBQb3J0Zm9saW9zIC0gJHtzdGFnZX1gLFxuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUzNPcmlnaW4ocG9ydGZvbGlvQnVja2V0LCB7XG4gICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IHBvcnRmb2xpb09haSxcbiAgICAgICAgfSksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRCxcbiAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KHRoaXMsICdQb3J0Zm9saW9DYWNoZVBvbGljeScsIHtcbiAgICAgICAgICBjYWNoZVBvbGljeU5hbWU6IGBzdGFja2ZvbGlvLXBvcnRmb2xpby1jYWNoZS0ke3N0YWdlfWAsXG4gICAgICAgICAgY29tbWVudDogJ0NhY2hlIHBvbGljeSBmb3IgcG9ydGZvbGlvIHBhZ2VzJyxcbiAgICAgICAgICBkZWZhdWx0VHRsOiBjZGsuRHVyYXRpb24uaG91cnMoMjQpLFxuICAgICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxuICAgICAgICAgIGVuYWJsZUFjY2VwdEVuY29kaW5nR3ppcDogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVBY2NlcHRFbmNvZGluZ0Jyb3RsaTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHByaWNlQ2xhc3M6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18xMDAsXG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kaXN0cmlidXRpb25Eb21haW5OYW1lID0gZGFzaGJvYXJkRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWU7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT1VUUFVUU1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGFzaGJvYXJkVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7ZGFzaGJvYXJkRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGFzaGJvYXJkIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgU3RhY2tmb2xpby1EYXNoYm9hcmRVcmwtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgdmFsdWU6IGRhc2hib2FyZERpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGFzaGJvYXJkIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBTdGFja2ZvbGlvLURhc2hib2FyZERpc3RJZC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUG9ydGZvbGlvVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7cG9ydGZvbGlvRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUG9ydGZvbGlvIHBhZ2VzIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgU3RhY2tmb2xpby1Qb3J0Zm9saW9VcmwtJHtzdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1BvcnRmb2xpb0Rpc3RyaWJ1dGlvbklkJywge1xuICAgICAgdmFsdWU6IHBvcnRmb2xpb0Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUG9ydGZvbGlvIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBTdGFja2ZvbGlvLVBvcnRmb2xpb0Rpc3RJZC0ke3N0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGFzaGJvYXJkQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRhc2hib2FyZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEYXNoYm9hcmQgUzMgYnVja2V0IG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYFN0YWNrZm9saW8tRGFzaGJvYXJkQnVja2V0LSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQb3J0Zm9saW9CdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHBvcnRmb2xpb0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQb3J0Zm9saW8gcGFnZXMgUzMgYnVja2V0IG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYFN0YWNrZm9saW8tUG9ydGZvbGlvQnVja2V0LSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb25maWdTdW1tYXJ5Jywge1xuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3RhZ2UsXG4gICAgICAgIGFwaUVuZHBvaW50LFxuICAgICAgICB1c2VyUG9vbElkLFxuICAgICAgICB1c2VyUG9vbENsaWVudElkLFxuICAgICAgICBkYXNoYm9hcmRVcmw6IGBodHRwczovLyR7ZGFzaGJvYXJkRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgICAgcG9ydGZvbGlvVXJsOiBgaHR0cHM6Ly8ke3BvcnRmb2xpb0Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29tcGxldGUgY29uZmlndXJhdGlvbiBmb3IgZnJvbnRlbmQgLmVudiBmaWxlJyxcbiAgICB9KTtcbiAgfVxufVxuIl19