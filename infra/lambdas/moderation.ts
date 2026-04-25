import type { S3Event } from 'aws-lambda';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
  type ModerationLabel,
} from '@aws-sdk/client-rekognition';
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

const rekognition = new RekognitionClient({});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
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
    const detect = await rekognition.send(
      new DetectModerationLabelsCommand({
        Image: { S3Object: { Bucket: bucket, Name: s3Key } },
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
  }
};
