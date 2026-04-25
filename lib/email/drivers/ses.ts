import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { sesClient } from '@/lib/aws/clients';
import type { EmailDriver, EmailMessage, SendEmailResult } from '../types';

function requireFrom(): string {
  const from = process.env.SES_FROM_ADDRESS;
  if (!from) throw new Error('Missing env var SES_FROM_ADDRESS');
  return from;
}

function defaultConfigurationSet(): string | undefined {
  return process.env.SES_CONFIGURATION_SET || undefined;
}

async function sendViaSes(message: EmailMessage): Promise<SendEmailResult> {
  const toAddresses = Array.isArray(message.to) ? [...message.to] : [message.to];
  const command = new SendEmailCommand({
    FromEmailAddress: requireFrom(),
    Destination: { ToAddresses: toAddresses },
    ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
    ConfigurationSetName: message.configurationSet ?? defaultConfigurationSet(),
    Content: {
      Simple: {
        Subject: { Data: message.rendered.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: message.rendered.html, Charset: 'UTF-8' },
          Text: { Data: message.rendered.text, Charset: 'UTF-8' },
        },
      },
    },
  });

  try {
    const response = await sesClient().send(command);
    return { ok: true, messageId: response.MessageId ?? 'unknown' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const sesDriver: EmailDriver = {
  name: 'ses',
  send: sendViaSes,
};
