import type { S3Event, S3EventRecord } from 'aws-lambda';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
  type ModerationLabel,
} from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { createHmac } from 'node:crypto';

const REJECT_LABELS = new Set([
  'Explicit Nudity',
  'Nudity',
  'Sexual Activity',
  'Graphic Violence',
  'Violence',
  'Visually Disturbing',
  'Hate Symbols',
]);
const REJECT_THRESHOLD = 80;

// Rekognition is not available in eu-west-3 (Paris); use eu-west-1 (Ireland).
// Bucket lives in eu-west-3, so we GetObject in-region then pass Bytes inline.
const rekognition = new RekognitionClient({
  region: process.env.REKOGNITION_REGION ?? 'eu-west-1',
});
const s3 = new S3Client({});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) chunks.push(chunk);
    else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
    else chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const lambdaClient = new LambdaClient({});

async function invokeVariantsAsync(record: S3EventRecord): Promise<void> {
  const functionName = process.env.VARIANTS_FUNCTION_NAME;
  if (!functionName) {
    console.log('[moderation] VARIANTS_FUNCTION_NAME unset; skipping variants invoke');
    return;
  }
  // The variants Lambda's handler accepts an S3Event; forward a single-record
  // synthetic event so it can read the same S3 object.
  const payload: S3Event = { Records: [record] };
  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // async fire-and-forget
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );
}

function decideFromLabels(labels: readonly ModerationLabel[]): {
  decision: 'approved' | 'rejected';
  topLabel?: string;
  topConfidence?: number;
} {
  let topLabel: string | undefined;
  let topConfidence = 0;
  for (const label of labels) {
    if (!label.Name || label.Confidence === undefined) continue;
    if (label.Confidence > topConfidence) {
      topConfidence = label.Confidence;
      topLabel = label.Name;
    }
    if (REJECT_LABELS.has(label.Name) && label.Confidence >= REJECT_THRESHOLD) {
      return { decision: 'rejected', topLabel: label.Name, topConfidence: label.Confidence };
    }
  }
  return { decision: 'approved', topLabel, topConfidence: topLabel ? topConfidence : undefined };
}

function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function callbackConvex(payload: {
  s3Key: string;
  decision: 'approved' | 'rejected';
  topLabel?: string;
  topConfidence?: number;
  labels: Array<{ name: string; confidence: number }>;
}): Promise<void> {
  const url = `${requireEnv('CONVEX_SITE_URL')}/lambda/photo-moderation-callback`;
  const secret = requireEnv('LAMBDA_CALLBACK_SECRET');
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = signPayload(secret, timestamp, body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wedillybird-signature': signature,
      'x-wedillybird-timestamp': timestamp,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Convex callback failed: ${response.status} ${await response.text()}`);
  }
}

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    if (!s3Key.startsWith('incoming/')) {
      console.log(`skip non-incoming key: ${s3Key}`);
      continue;
    }

    console.log(`moderating s3://${bucket}/${s3Key}`);
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
    if (!object.Body) {
      throw new Error(`s3 object body missing for ${s3Key}`);
    }
    const bytes = await streamToBuffer(object.Body as NodeJS.ReadableStream);
    const detect = await rekognition.send(
      new DetectModerationLabelsCommand({
        Image: { Bytes: bytes },
        MinConfidence: 50,
      }),
    );
    const labels = detect.ModerationLabels ?? [];
    const { decision, topLabel, topConfidence } = decideFromLabels(labels);

    await callbackConvex({
      s3Key,
      decision,
      topLabel,
      topConfidence,
      labels: labels
        .filter((l): l is ModerationLabel & { Name: string; Confidence: number } =>
          Boolean(l.Name && l.Confidence !== undefined),
        )
        .map((l) => ({ name: l.Name, confidence: l.Confidence })),
    });
    console.log(`decision=${decision} top=${topLabel ?? 'none'}@${topConfidence ?? 0}`);

    // Trigger sharp variants asynchronously for approved photos only.
    if (decision === 'approved') {
      try {
        await invokeVariantsAsync(record);
      } catch (err) {
        console.error(
          `[moderation] failed to invoke variants for ${s3Key}: ${err instanceof Error ? err.message : err}`,
        );
        // Don't rethrow — the photo is approved and the user-visible flow
        // doesn't depend on variants existing.
      }
    }
  }
};
