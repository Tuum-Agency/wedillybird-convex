import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'node:path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export type WedillybirdMediaStackProps = StackProps & {
  /** Bucket name. Must be globally unique. */
  bucketName: string;
  /** Custom domain served by CloudFront (e.g. media.wedillybird.com). */
  cdnDomain: string;
  /** ACM certificate ARN for the CloudFront distribution. Must live in us-east-1. */
  certificateArn: string;
  /**
   * Origins allowed to PUT/GET via CORS (browser uploads). Add Vercel preview wildcard
   * via separate regex entries if needed.
   */
  corsAllowedOrigins: readonly string[];
  /**
   * If both are set, deploys a Rekognition-driven moderation Lambda triggered on
   * objects added under `incoming/` prefix. Lambda POSTs HMAC-signed callbacks to
   * `${convexSiteUrl}/lambda/photo-moderation-callback`.
   */
  convexSiteUrl?: string;
  lambdaCallbackSecret?: string;
};

export class WedillybirdMediaStack extends Stack {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WedillybirdMediaStackProps) {
    super(scope, id, props);

    const { bucketName, cdnDomain, certificateArn, corsAllowedOrigins } = props;

    this.bucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: [...corsAllowedOrigins],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'expire-incoming-staging',
          prefix: 'incoming/',
          expiration: Duration.days(30),
          noncurrentVersionExpiration: Duration.days(7),
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
        {
          id: 'archive-processed',
          prefix: 'processed/',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(90),
            },
          ],
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
    });

    const certificate = acm.Certificate.fromCertificateArn(this, 'Cert', certificateArn);

    this.distribution = new cloudfront.Distribution(this, 'MediaDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,
        compress: true,
      },
      domainNames: [cdnDomain],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableLogging: false,
      comment: 'Wedillybird media CDN',
    });

    new CfnOutput(this, 'BucketName', { value: this.bucket.bucketName });
    new CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
    });
    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
    new CfnOutput(this, 'CdnDomain', { value: cdnDomain });

    if (props.convexSiteUrl && props.lambdaCallbackSecret) {
      const moderationFunction = new NodejsFunction(this, 'ModerationFunction', {
        entry: path.join(__dirname, '..', 'lambdas', 'moderation.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        timeout: Duration.seconds(30),
        environment: {
          CONVEX_SITE_URL: props.convexSiteUrl,
          LAMBDA_CALLBACK_SECRET: props.lambdaCallbackSecret,
        },
        bundling: {
          target: 'node22',
          format: OutputFormat.CJS,
          sourceMap: true,
        },
        description: 'Wedillybird photo moderation via Rekognition; callbacks to Convex',
      });

      moderationFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['rekognition:DetectModerationLabels'],
          resources: ['*'],
        }),
      );
      this.bucket.grantRead(moderationFunction);

      moderationFunction.addEventSource(
        new S3EventSource(this.bucket, {
          events: [s3.EventType.OBJECT_CREATED],
          filters: [{ prefix: 'incoming/' }],
        }),
      );

      new CfnOutput(this, 'ModerationFunctionName', { value: moderationFunction.functionName });

      /* ---------------------------------------------------------------- */
      /*  Variants Lambda (sharp resize → webp thumb / medium / full)     */
      /* ---------------------------------------------------------------- */
      // Triggered in parallel with moderation on the same `incoming/` prefix.
      // Running them independently is simpler than chaining via lambda.invoke
      // (no IAM coupling, isolated retries) and the variants Lambda only
      // touches `processed/` keys + a separate Convex callback path, so they
      // never compete for the same DB row.
      const variantsFunction = new NodejsFunction(this, 'VariantsFunction', {
        entry: path.join(__dirname, '..', 'lambdas', 'variants.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 1536,
        timeout: Duration.seconds(60),
        environment: {
          CONVEX_SITE_URL: props.convexSiteUrl,
          LAMBDA_CALLBACK_SECRET: props.lambdaCallbackSecret,
        },
        bundling: {
          target: 'node22',
          format: OutputFormat.CJS,
          sourceMap: true,
          // sharp ships native bindings (.node files). Keep it external from the
          // esbuild bundle and reinstall it into node_modules for the Lambda's
          // arch (ARM64 Linux) via a post-bundling hook, so the right prebuilt
          // binary is shipped instead of the host's (likely macOS arm64).
          externalModules: ['sharp'],
          nodeModules: ['sharp'],
          forceDockerBundling: false,
          commandHooks: {
            beforeBundling: () => [],
            beforeInstall: () => [],
            afterBundling: (_input: string, output: string) => [
              [
                `cd ${output}`,
                'rm -rf node_modules/sharp',
                'npm install --no-save --os=linux --cpu=arm64 sharp@^0.33.5',
              ].join(' && '),
            ],
          },
        },
        description: 'Wedillybird photo variants generation (sharp → webp 320/800/2000)',
      });

      this.bucket.grantRead(variantsFunction);
      this.bucket.grantPut(variantsFunction, 'processed/*');

      variantsFunction.addEventSource(
        new S3EventSource(this.bucket, {
          events: [s3.EventType.OBJECT_CREATED],
          filters: [{ prefix: 'incoming/' }],
        }),
      );

      new CfnOutput(this, 'VariantsFunctionName', { value: variantsFunction.functionName });
    }
  }
}
