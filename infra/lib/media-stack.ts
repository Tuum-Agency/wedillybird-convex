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
import { SnsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';

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
  /**
   * Optional. If set, the moderation Lambda calls the OpenAI Moderation API
   * (`omni-moderation-latest`) as an additional semantic safety net after
   * Rekognition. Free of charge but requires an API key. Skipped silently
   * when absent (Lambda still works, just without this last layer).
   */
  openaiApiKey?: string;
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
      // Fan-out S3 → SNS → 2 Lambdas. Une notification S3 directe n'autorise
      // qu'UNE règle par (préfixe, événement) : deux Lambdas sur `incoming/`
      // OBJECT_CREATED déclenche « Configuration is ambiguously defined ». On
      // passe donc par un topic SNS auquel modération ET variants s'abonnent.
      const uploadTopic = new sns.Topic(this, 'IncomingUploadTopic', {
        displayName: 'Wedillybird incoming media uploads',
      });
      this.bucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        new s3n.SnsDestination(uploadTopic),
        { prefix: 'incoming/' },
      );

      // DLQ des invocations Lambda échouées. SNS → Lambda est une invocation
      // ASYNCHRONE : après les retries internes de Lambda, un événement en échec
      // (callback Convex 401, timeout Sharp, quota Rekognition...) est autrement
      // PERDU en silence — la galerie reste vide sans trace. Retenu 14 j pour
      // inspection / replay quand le cron `photosModerationHealth` signale des
      // photos bloquées (mode d'échec F4 du premortem).
      const moderationDlq = new sqs.Queue(this, 'ModerationDlq', {
        retentionPeriod: Duration.days(14),
      });
      const variantsDlq = new sqs.Queue(this, 'VariantsDlq', {
        retentionPeriod: Duration.days(14),
      });

      const moderationFunction = new NodejsFunction(this, 'ModerationFunction', {
        entry: path.join(__dirname, '..', 'lambdas', 'moderation.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        timeout: Duration.seconds(30),
        deadLetterQueue: moderationDlq,
        environment: {
          CONVEX_SITE_URL: props.convexSiteUrl,
          LAMBDA_CALLBACK_SECRET: props.lambdaCallbackSecret,
          ...(props.openaiApiKey ? { OPENAI_API_KEY: props.openaiApiKey } : {}),
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
          // DetectText : OCR pour matcher les mots-clés blacklist (anatomie
          // explicite, drogues, argot — fait passer les illustrations
          // anatomiques avec légende).
          // DetectLabels : détecte si l'image est une illustration / dessin /
          // schéma — dans ce cas on évite l'auto-approbation et on demande
          // une validation owner manuelle.
          // CreateCollection / DescribeCollection / IndexFaces : indexation
          // automatique des visages des photos approved pour permettre la
          // recherche par selfie depuis l'invité ("retrouver mes photos").
          // DeleteCollection : nettoyage à la suppression / archivage de
          // l'event (cleanup côté Convex à câbler — cf. BACKLOG).
          actions: [
            'rekognition:DetectModerationLabels',
            'rekognition:DetectText',
            'rekognition:DetectLabels',
            'rekognition:CreateCollection',
            'rekognition:DescribeCollection',
            'rekognition:IndexFaces',
            'rekognition:DeleteCollection',
          ],
          resources: ['*'],
        }),
      );
      this.bucket.grantRead(moderationFunction);

      moderationFunction.addEventSource(new SnsEventSource(uploadTopic));

      new CfnOutput(this, 'ModerationFunctionName', { value: moderationFunction.functionName });

      /* ------------------------------------------------------------------ */
      /*  Variants Lambda (Sharp resize → thumb/medium/large WebP)          */
      /* ------------------------------------------------------------------ */
      /* Tourne en parallèle de la modération sur le même trigger S3        */
      /* `incoming/`. Sharp est un binaire natif : on le marque              */
      /* `nodeModules: ['sharp']` pour qu'esbuild copie le module dans le    */
      /* bundle plutôt que de l'inliner — sinon le binaire `linux-arm64`    */
      /* compilé pendant `pnpm install` n'arriverait pas dans la Lambda.    */
      /* Architecture ARM64 alignée avec la modération (coût / perf).        */
      /* ------------------------------------------------------------------ */
      const variantsFunction = new NodejsFunction(this, 'VariantsFunction', {
        entry: path.join(__dirname, '..', 'lambdas', 'variants.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        // Sharp peut consommer 200-400 MB de RAM sur des images 12 MP. 1 GB
        // donne aussi plus de CPU (Lambda alloue le CPU proportionnellement
        // à la mémoire), ce qui réduit le wall-time de ~2.5x sur Sharp.
        memorySize: 1024,
        timeout: Duration.seconds(60),
        deadLetterQueue: variantsDlq,
        environment: {
          CONVEX_SITE_URL: props.convexSiteUrl,
          LAMBDA_CALLBACK_SECRET: props.lambdaCallbackSecret,
        },
        // Lockfile de l'infra (pnpm workspace : root). CDK l'utilise pour
        // détecter le package manager (pnpm) lors du bundling Docker pour
        // installer les `nodeModules` natifs (Sharp).
        depsLockFilePath: path.join(__dirname, '..', '..', 'pnpm-lock.yaml'),
        bundling: {
          target: 'node22',
          format: OutputFormat.CJS,
          sourceMap: true,
          // Sharp a un binaire natif spécifique à la plateforme. `nodeModules`
          // demande à CDK d'installer `sharp` pendant le bundling ; ses binaires
          // (`@img/sharp-*`) sont résolus pour la plateforme de CETTE installation.
          // ⚠️ CDK n'utilise Docker que si esbuild n'est PAS dispo en local :
          // un `cdk deploy` depuis un mac (esbuild présent) bundle donc le binaire
          // `darwin` et la Lambda arm64 plante au runtime avec
          // « Could not load the "sharp" module using the linux-arm64 runtime ».
          // `forceDockerBundling` force l'install DANS l'image de build arm64
          // (alignée sur `architecture: ARM_64`) → binaire `linux-arm64` correct,
          // quel que soit l'OS du poste qui déploie.
          forceDockerBundling: true,
          nodeModules: ['sharp'],
          // Le SDK AWS est natif au runtime Lambda Node 22 — on l'externalise
          // pour réduire la taille du bundle.
          externalModules: ['@aws-sdk/client-s3'],
        },
        description: 'Wedillybird photo variants (Sharp WebP thumb/medium/large)',
      });

      this.bucket.grantRead(variantsFunction);
      // PUT scope-down : `processed/*` uniquement, pas les uploads bruts ni
      // d'autres prefix S3 (pas de risque d'overwrite d'un objet `incoming/`).
      variantsFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['s3:PutObject', 's3:PutObjectAcl'],
          resources: [`${this.bucket.bucketArn}/processed/*`],
        }),
      );

      variantsFunction.addEventSource(new SnsEventSource(uploadTopic));

      new CfnOutput(this, 'VariantsFunctionName', { value: variantsFunction.functionName });
    }
  }
}
