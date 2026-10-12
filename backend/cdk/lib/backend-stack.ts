import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export interface StackfolioBackendStackProps extends cdk.StackProps {
  stage: string;
}

export class StackfolioBackendStack extends cdk.Stack {
  public readonly apiEndpoint: string;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;
  public readonly contentBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StackfolioBackendStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // ========================================
    // S3 BUCKET - Content Storage
    // ========================================
    this.contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: `stackfolio-content-${stage}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: stage === 'alpha' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: stage === 'alpha',
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // Tag bucket for easy identification
    cdk.Tags.of(this.contentBucket).add('Stage', stage);
    cdk.Tags.of(this.contentBucket).add('Purpose', 'User-uploaded content and generated HTML');

    // ========================================
    // COGNITO - User Authentication
    // ========================================
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `stackfolio-users-${stage}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: stage === 'alpha' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: `stackfolio-client-${stage}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
    });

    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;

    // ========================================
    // IAM ROLE - Lambda Execution Role
    // ========================================
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `stackfolio-lambda-role-${stage}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // S3 permissions
    this.contentBucket.grantReadWrite(lambdaRole);

    // Bedrock permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
      ],
    }));

    // Textract permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'textract:DetectDocumentText',
        'textract:AnalyzeDocument',
      ],
      resources: ['*'],
    }));

    // Rekognition permissions (for image analysis)
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rekognition:DetectLabels',
        'rekognition:DetectText',
      ],
      resources: ['*'],
    }));

    // ========================================
    // LAMBDA FUNCTIONS
    // ========================================

    // Common Lambda environment variables
    const lambdaEnvironment = {
      STAGE: stage,
      CONTENT_BUCKET: this.contentBucket.bucketName,
      REGION: this.region, // Use REGION instead of AWS_REGION (reserved)
    };

    // Content Processor Lambda
    const contentProcessor = new lambda.Function(this, 'ContentProcessor', {
      functionName: `stackfolio-content-processor-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist/lambdas/content-processor'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(300),
      memorySize: 512,
      environment: lambdaEnvironment,
      description: `[${stage}] Extracts content from uploaded files`,
    });

    // S3 trigger for content processor
    this.contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(contentProcessor),
      { prefix: 'users/', suffix: '.pdf' }
    );
    this.contentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(contentProcessor),
      { prefix: 'users/', suffix: '.txt' }
    );

    // HTML Generator Lambda
    const htmlGenerator = new lambda.Function(this, 'HtmlGenerator', {
      functionName: `stackfolio-html-generator-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist/lambdas/html-generator'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: lambdaEnvironment,
      description: `[${stage}] Generates HTML from content manifest`,
    });

    // Chat Handler Lambda (separate role to avoid circular dependency)
    const chatHandlerRole = new iam.Role(this, 'ChatHandlerRole', {
      roleName: `stackfolio-chat-handler-role-${stage}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant chat handler access to S3 and Bedrock
    this.contentBucket.grantReadWrite(chatHandlerRole);
    chatHandlerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
      ],
    }));

    const chatHandler = new lambda.Function(this, 'ChatHandler', {
      functionName: `stackfolio-chat-handler-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist/lambdas/chat-handler'),
      role: chatHandlerRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ...lambdaEnvironment,
        HTML_GENERATOR_FUNCTION: htmlGenerator.functionName,
      },
      description: `[${stage}] Handles chat-based content editing`,
    });

    // Grant chat handler permission to invoke HTML generator
    htmlGenerator.grantInvoke(chatHandler);

    // Publish Handler Lambda
    const publishHandler = new lambda.Function(this, 'PublishHandler', {
      functionName: `stackfolio-publish-handler-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist/lambdas/publish-handler'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: lambdaEnvironment,
      description: `[${stage}] Publishes draft to live`,
    });

    // ========================================
    // API GATEWAY
    // ========================================
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `stackfolio-api-${stage}`,
      description: `Stackfolio API - ${stage}`,
      deployOptions: {
        stageName: stage,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `stackfolio-authorizer-${stage}`,
    });

    // Health check Lambda (with CORS)
    const healthCheckLambda = new lambda.Function(this, 'HealthCheck', {
      functionName: `stackfolio-health-check-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist/lambdas/health-check'),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: lambdaEnvironment,
      description: `[${stage}] Health check endpoint`,
    });

    // Health check endpoint (no auth)
    const health = api.root.addResource('health');
    health.addMethod('GET', new apigateway.LambdaIntegration(healthCheckLambda));

    // Chat endpoint
    const chat = api.root.addResource('chat');
    chat.addMethod('POST', new apigateway.LambdaIntegration(chatHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Publish endpoint
    const publish = api.root.addResource('publish');
    publish.addMethod('POST', new apigateway.LambdaIntegration(publishHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Users endpoint for preview
    const users = api.root.addResource('users');
    const userId = users.addResource('{userId}');
    const preview = userId.addResource('preview');
    preview.addMethod('GET', new apigateway.LambdaIntegration(htmlGenerator), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    this.apiEndpoint = api.url;

    // ========================================
    // OUTPUTS
    // ========================================
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: `Stackfolio-ApiEndpoint-${stage}`,
    });

    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: this.contentBucket.bucketName,
      description: 'S3 bucket for content storage',
      exportName: `Stackfolio-ContentBucket-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `Stackfolio-UserPoolId-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `Stackfolio-UserPoolClientId-${stage}`,
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
      exportName: `Stackfolio-Region-${stage}`,
    });
  }
}
