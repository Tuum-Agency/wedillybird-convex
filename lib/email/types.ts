export type EmailRendered = {
  subject: string;
  html: string;
  text: string;
};

export type EmailMessage = {
  to: string | readonly string[];
  rendered: EmailRendered;
  replyTo?: string;
  configurationSet?: string;
};

export type SendEmailResult =
  | {
      ok: true;
      messageId: string;
    }
  | {
      ok: false;
      error: string;
    };

export type EmailDriver = {
  name: 'ses' | 'mock';
  send(message: EmailMessage): Promise<SendEmailResult>;
};
