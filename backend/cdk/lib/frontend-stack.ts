import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface StackfolioFrontendStackProps extends cdk.StackProps {
  stage: string;
  apiEndpoint: string;
  userPoolId: string;
  userPoolClientId: string;
}

export class StackfolioFrontendStack extends cdk.Stack {
  public readonly distributionDomainName: string;
  public readonly dashboardBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StackfolioFrontendStackProps) {
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
