import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
export interface StackfolioFrontendStackProps extends cdk.StackProps {
    stage: string;
    apiEndpoint: string;
    userPoolId: string;
    userPoolClientId: string;
}
export declare class StackfolioFrontendStack extends cdk.Stack {
    readonly distributionDomainName: string;
    readonly dashboardBucket: s3.Bucket;
    constructor(scope: Construct, id: string, props: StackfolioFrontendStackProps);
}
