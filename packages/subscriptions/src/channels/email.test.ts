import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { EmailClient } from "@openstatus/emails";
import type { PageUpdate, Subscription } from "../types";
import {
  sendEmailNotifications,
  sendEmailVerification,
  validateEmailConfig,
} from "./email";

// RESEND_API_KEY is set in test-preload.ts (see bunfig.toml) so @openstatus/emails
// loads successfully and EmailClient prototype methods can be spied on.

const sendPageSubscriptionMock = spyOn(
  EmailClient.prototype,
  "sendPageSubscription",
).mockResolvedValue(undefined);

const sendStatusReportUpdateMock = spyOn(
  EmailClient.prototype,
  "sendStatusReportUpdate",
).mockResolvedValue(undefined);

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    pageId: 1,
    pageName: "Test Page",
    pageSlug: "test",
    channelType: "email",
    email: "user@example.com",
    token: "token-123",
    componentIds: [],
    ...overrides,
  };
}

function makeUpdate(overrides: Partial<PageUpdate> = {}): PageUpdate {
  return {
    id: 1,
    pageId: 1,
    title: "Test Incident",
    status: "investigating",
    message: "We are investigating.",
    pageComponentIds: [],
    pageComponents: [],
    date: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  sendPageSubscriptionMock.mockClear();
  sendStatusReportUpdateMock.mockClear();
});

// ─── validateEmailConfig ──────────────────────────────────────────────────────

describe("validateEmailConfig", () => {
  test("returns valid for a valid email address", async () => {
    const result = await validateEmailConfig("user@example.com");
    expect(result.valid).toBe(true);
  });

  test("returns invalid for a plain string without @", async () => {
    const result = await validateEmailConfig("not-an-email");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("returns invalid for non-string input", async () => {
    const result = await validateEmailConfig(42);
    expect(result.valid).toBe(false);
  });

  test("returns invalid for null", async () => {
    const result = await validateEmailConfig(null);
    expect(result.valid).toBe(false);
  });
});

// ─── sendEmailVerification ────────────────────────────────────────────────────

describe("sendEmailVerification", () => {
  test("throws when subscription has no email", async () => {
    const sub = makeSub({ email: undefined });
    await expect(
      sendEmailVerification(sub, "https://example.com/verify/token"),
    ).rejects.toThrow("Email is required");
  });

  test("calls sendPageSubscription with the correct arguments", async () => {
    const sub = makeSub({ email: "user@example.com", pageName: "My Page" });
    await sendEmailVerification(sub, "https://example.com/verify/abc");

    expect(sendPageSubscriptionMock).toHaveBeenCalledTimes(1);
    const [args] = sendPageSubscriptionMock.mock.calls[0];
    expect(args.to).toBe("user@example.com");
    expect(args.link).toBe("https://example.com/verify/abc");
    expect(args.page).toBe("My Page");
  });
});

// ─── sendEmailNotifications ───────────────────────────────────────────────────

describe("sendEmailNotifications", () => {
  test("does nothing for an empty subscriptions array", async () => {
    await sendEmailNotifications([], makeUpdate());
    expect(sendStatusReportUpdateMock).not.toHaveBeenCalled();
  });

  test("filters out subscriptions without an email address", async () => {
    const sub = makeSub({ email: undefined });
    await sendEmailNotifications([sub], makeUpdate());
    expect(sendStatusReportUpdateMock).not.toHaveBeenCalled();
  });

  test("calls sendStatusReportUpdate once with all valid subscribers", async () => {
    const sub1 = makeSub({ email: "a@example.com", token: "token-a" });
    const sub2 = makeSub({ email: "b@example.com", token: "token-b" });
    const update = makeUpdate({ title: "Outage", status: "resolved" });

    await sendEmailNotifications([sub1, sub2], update);

    expect(sendStatusReportUpdateMock).toHaveBeenCalledTimes(1);
    const [args] = sendStatusReportUpdateMock.mock.calls[0];
    expect(args.subscribers).toHaveLength(2);
    expect(args.subscribers[0].email).toBe("a@example.com");
    expect(args.subscribers[1].email).toBe("b@example.com");
    expect(args.reportTitle).toBe("Outage");
    expect(args.status).toBe("resolved");
  });

  test("passes page components to sendStatusReportUpdate", async () => {
    const sub = makeSub({ email: "user@example.com" });
    const update = makeUpdate({ pageComponents: ["API", "Database"] });

    await sendEmailNotifications([sub], update);

    const [args] = sendStatusReportUpdateMock.mock.calls[0];
    expect(args.pageComponents).toEqual(["API", "Database"]);
  });
});
