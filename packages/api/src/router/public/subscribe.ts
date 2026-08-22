
import { z } from 'zod';

export interface SubscriberRecord {
  id: string;
  email: string;
  pageId: string;
  confirmed: boolean;
  token?: string;
  tokenExpiresAt?: Date;
  lastEmailSentAt?: Date;
}

/**
 * Deduplicated email confirmation dispatching to prevent spam and double send.
 */
export function shouldDispatchVerificationEmail(subscriber: SubscriberRecord, now: Date = new Date()): boolean {
  if (subscriber.confirmed) return false;
  if (!subscriber.lastEmailSentAt) return true;
  const cooldownMs = 60 * 1000; // 60s cooldown between dispatch retries
  return (now.getTime() - subscriber.lastEmailSentAt.getTime()) > cooldownMs;
}
