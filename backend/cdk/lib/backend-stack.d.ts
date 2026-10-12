import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
export interface StackfolioBackendStackProps extends cdk.StackProps {
    stage: string;
}
export declare class StackfolioBackendStack extends cdk.Stack {
    readonly apiEndpoint: string;
    readonly userPoolId: string;
    readonly userPoolClientId: string;
    readonly contentBucket: s3.Bucket;
    constructor(scope: Construct, id: string, props: StackfolioBackendStackProps);
}
