import { describe, it, expect, beforeEach } from "vitest";

import {
  shouldDispatchVerificationEmail,
  acquireEmailDispatchLock,
  releaseEmailDispatchLock,
  SubscriberRecord,
} from "./subscribe";

describe("OpenStatus Email Verification Deduplication & Concurrency Guard", () => {
  it("does not send email if already confirmed", () => {
    const sub: SubscriberRecord = {
      id: "1",
      email: "test@example.com",
      pageId: "p1",
      confirmed: true,
    };
    expect(shouldDispatchVerificationEmail(sub)).toBe(false);
  });

  it("sends email on first attempt", () => {
    const sub: SubscriberRecord = {
      id: "2",
      email: "test@example.com",
      pageId: "p1",
      confirmed: false,
    };
    expect(shouldDispatchVerificationEmail(sub)).toBe(true);
  });

  it("prevents double sending within cooldown period", () => {
    const now = new Date();
    const recentSent = new Date(now.getTime() - 10 * 1000); // 10s ago
    const sub: SubscriberRecord = {
      id: "3",
      email: "test@example.com",
      pageId: "p1",
      confirmed: false,
      lastEmailSentAt: recentSent,
    };
    expect(shouldDispatchVerificationEmail(sub, now)).toBe(false);
  });

  it("atomic lock prevents concurrent race-condition dispatches", () => {
    const email = "user@example.com";
    const pageId = "page_123";
    expect(acquireEmailDispatchLock(email, pageId)).toBe(true);
    expect(acquireEmailDispatchLock(email, pageId)).toBe(false); // Second concurrent call blocked
    releaseEmailDispatchLock(email, pageId);
    expect(acquireEmailDispatchLock(email, pageId)).toBe(true); // Can acquire after release
    releaseEmailDispatchLock(email, pageId);
  });
});
