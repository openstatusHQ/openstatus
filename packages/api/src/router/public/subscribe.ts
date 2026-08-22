import { z } from "zod";

export interface SubscriberRecord {
  id: string;
  email: string;
  pageId: string;
  confirmed: boolean;
  token?: string;
  tokenExpiresAt?: Date;
  lastEmailSentAt?: Date;
  isDispatching?: boolean;
}

// In-flight dispatch lock table to prevent race-condition concurrency duplicate emails
const dispatchLocks = new Set<string>();

/**
 * Atomic deduplication and lock acquisition for email confirmation dispatching.
 * Prevents concurrent P1 race conditions and double sending.
 */
export function acquireEmailDispatchLock(
  email: string,
  pageId: string,
): boolean {
  const lockKey = `${pageId.toLowerCase()}:${email.toLowerCase()}`;
  if (dispatchLocks.has(lockKey)) {
    return false; // Concurrent lock already held
  }
  dispatchLocks.add(lockKey);
  return true;
}

export function releaseEmailDispatchLock(email: string, pageId: string): void {
  const lockKey = `${pageId.toLowerCase()}:${email.toLowerCase()}`;
  dispatchLocks.delete(lockKey);
}

/**
 * Deduplicated email confirmation dispatching to prevent spam and double send.
 */
export function shouldDispatchVerificationEmail(
  subscriber: SubscriberRecord,
  now: Date = new Date(),
): boolean {
  if (subscriber.confirmed) return false;
  if (subscriber.isDispatching) return false;
  if (!subscriber.lastEmailSentAt) return true;
  const cooldownMs = 60 * 1000; // 60s cooldown between dispatch retries
  return now.getTime() - subscriber.lastEmailSentAt.getTime() > cooldownMs;
}
