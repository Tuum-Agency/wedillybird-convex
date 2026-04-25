import { S3Client } from '@aws-sdk/client-s3';
import { SESv2Client } from '@aws-sdk/client-sesv2';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function getCredentials() {
  return {
    accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
  };
}

function getRegion(): string {
  return process.env.AWS_REGION ?? 'eu-west-3';
}

let s3Singleton: S3Client | null = null;
export function s3Client(): S3Client {
  s3Singleton ??= new S3Client({ region: getRegion(), credentials: getCredentials() });
  return s3Singleton;
}

let sesSingleton: SESv2Client | null = null;
export function sesClient(): SESv2Client {
  sesSingleton ??= new SESv2Client({ region: getRegion(), credentials: getCredentials() });
  return sesSingleton;
}

export const awsConfig = {
  region: getRegion,
  accountId: () => requireEnv('AWS_ACCOUNT_ID'),
};
