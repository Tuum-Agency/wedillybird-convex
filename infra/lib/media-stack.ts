import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export type WedillybirdMediaStackProps = StackProps & {
  /**
   * Bucket name. Must be globally unique.
   */
  bucketName: string;
  /**
   * Custom domain served by CloudFront (e.g. media.wedillybird.com).
   */
  cdnDomain: string;
  /**
   * ACM certificate ARN for the CloudFront distribution. Must live in us-east-1.
   */
  certificateArn: string;
  /**
   * Origins allowed to PUT/GET via CORS (browser uploads). Add Vercel preview wildcard
   * via separate regex entries if needed.
   */
  corsAllowedOrigins: readonly string[];
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
  }
}
