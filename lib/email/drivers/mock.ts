import type { EmailDriver, EmailMessage, SendEmailResult } from '../types';

export type MockSentEmail = EmailMessage & { sentAt: number; messageId: string };

const sentEmails: MockSentEmail[] = [];

async function sendViaMock(message: EmailMessage): Promise<SendEmailResult> {
  const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  sentEmails.push({ ...message, sentAt: Date.now(), messageId });
  if (process.env.NODE_ENV !== 'test') {
    const to = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    console.log(`[email:mock] → ${to} | ${message.rendered.subject}`);
  }
  return { ok: true, messageId };
}

export function getMockSentEmails(): readonly MockSentEmail[] {
  return sentEmails;
}

export function clearMockSentEmails(): void {
  sentEmails.length = 0;
}

export const mockDriver: EmailDriver = {
  name: 'mock',
  send: sendViaMock,
};
