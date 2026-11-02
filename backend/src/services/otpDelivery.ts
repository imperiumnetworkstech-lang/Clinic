import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Delivers one-time codes to patients. The clinic has chosen manual WhatsApp, so there is no
 * automated channel yet; the production provider (SMS gateway or email) is pending a client
 * decision. Until then production reports OTP login as unavailable instead of failing silently.
 */
export interface OtpDelivery {
  readonly available: boolean;
  send(phone: string, code: string): Promise<void>;
}

class DevLogDelivery implements OtpDelivery {
  readonly available = true;

  async send(phone: string, code: string): Promise<void> {
    // Dev-only (env validation forbids this mode in production). Deliberately bypasses the
    // redaction rules so a developer can complete the login flow locally.
    logger.warn(`[dev OTP] ${phone} → ${code}`);
  }
}

class UnavailableDelivery implements OtpDelivery {
  readonly available = false;

  async send(): Promise<void> {
    throw new Error('OTP delivery is not configured');
  }
}

export const otpDelivery: OtpDelivery =
  env.OTP_DELIVERY === 'log' ? new DevLogDelivery() : new UnavailableDelivery();
