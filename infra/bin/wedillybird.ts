#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WedillybirdMediaStack } from '../lib/media-stack';

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID;
if (!account) {
  throw new Error('Missing AWS_ACCOUNT_ID (or CDK_DEFAULT_ACCOUNT) env var');
}

const region = process.env.AWS_REGION ?? 'eu-west-3';

const certificateArn =
  process.env.MEDIA_CERTIFICATE_ARN ?? app.node.tryGetContext('mediaCertificateArn');
if (!certificateArn) {
  throw new Error(
    'Missing MEDIA_CERTIFICATE_ARN env var (ACM cert in us-east-1 for media.wedillybird.com)',
  );
}

new WedillybirdMediaStack(app, 'WedillybirdMediaStack', {
  env: { account, region },
  bucketName: process.env.MEDIA_BUCKET_NAME ?? 'wedillybird-media-prod',
  cdnDomain: process.env.MEDIA_CDN_DOMAIN ?? 'media.wedillybird.com',
  certificateArn,
  corsAllowedOrigins: (
    process.env.MEDIA_CORS_ORIGINS ??
    'https://wedillybird.com,https://www.wedillybird.com,http://localhost:3000'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL,
  lambdaCallbackSecret: process.env.LAMBDA_CALLBACK_SECRET,
  description: 'Wedillybird media S3 bucket + CloudFront + Rekognition moderation Lambda',
});
