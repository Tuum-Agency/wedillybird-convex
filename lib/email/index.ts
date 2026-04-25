import { mockDriver } from './drivers/mock';
import { sesDriver } from './drivers/ses';
import type { EmailDriver, EmailMessage, SendEmailResult } from './types';

export function getEmailDriver(): EmailDriver {
  if (process.env.EMAIL_DRIVER === 'mock') return mockDriver;
  if (process.env.NODE_ENV === 'test') return mockDriver;
  return sesDriver;
}

export function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  return getEmailDriver().send(message);
}

export type { EmailDriver, EmailMessage, SendEmailResult } from './types';
export type { EmailRendered } from './types';
