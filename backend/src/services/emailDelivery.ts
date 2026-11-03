import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Transactional email (patient portal sign-in links). Provider-agnostic so it can move from
 * Resend to SMTP or another service without touching callers.
 */
export interface EmailDelivery {
  readonly available: boolean;
  send(message: EmailMessage): Promise<void>;
}

class DevLogEmail implements EmailDelivery {
  readonly available = true;

  async send(message: EmailMessage): Promise<void> {
    // Dev-only (env validation forbids this mode in production); lets developers follow links.
    logger.warn(`[dev email] to ${message.to}: ${message.subject}\n${message.text}`);
  }
}

class ResendEmail implements EmailDelivery {
  readonly available = true;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, ...message }),
    });
    if (!response.ok) {
      throw new Error(`Email provider rejected the message (${response.status})`);
    }
  }
}

class UnavailableEmail implements EmailDelivery {
  readonly available = false;

  async send(): Promise<void> {
    throw new Error('Email delivery is not configured');
  }
}

function create(): EmailDelivery {
  if (env.EMAIL_DELIVERY === 'log') return new DevLogEmail();
  if (env.EMAIL_DELIVERY === 'resend' && env.RESEND_API_KEY && env.EMAIL_FROM) {
    return new ResendEmail(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return new UnavailableEmail();
}

export const emailDelivery: EmailDelivery = create();
