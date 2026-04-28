import { mockDriver } from './drivers/mock';
import { sesDriver } from './drivers/ses';
import type { EmailDriver, EmailMessage, SendEmailResult } from './types';

export function getEmailDriver(): EmailDriver {
  // Mode E2E : force le driver mock pour que les tests Playwright n'envoient
  // jamais de mail réel via SES. Mêmes contraintes que pour WhatsApp.
  if (process.env.E2E_MODE === '1') return mockDriver;
  if (process.env.EMAIL_DRIVER === 'mock') return mockDriver;
  if (process.env.NODE_ENV === 'test') return mockDriver;
  return sesDriver;
}

export function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  return getEmailDriver().send(message);
}

export type { EmailDriver, EmailMessage, SendEmailResult } from './types';
export type { EmailRendered } from './types';
