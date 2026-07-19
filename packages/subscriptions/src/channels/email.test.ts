import "../test-preload.ts";
import { EmailClient } from "@openstatus/emails";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";

import type { PageUpdate, Subscription } from "../types";
import {
  sendEmailNotifications,
  sendEmailVerification,
  validateEmailConfig,
} from "./email";

// RESEND_API_KEY is set in test-preload.ts (see bunfig.toml) so @openstatus/emails
// loads successfully and EmailClient prototype methods can be spied on.

let sendPageSubscriptionMock: Stub<EmailClient>;
let sendStatusReportUpdateMock: Stub<EmailClient>;

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
  sendPageSubscriptionMock = stub(
    EmailClient.prototype,
    "sendPageSubscription",
    () => Promise.resolve(undefined),
  );
  sendStatusReportUpdateMock = stub(
    EmailClient.prototype,
    "sendStatusReportUpdate",
    () => Promise.resolve(undefined),
  );
});

afterEach(() => {
  sendPageSubscriptionMock.restore();
  sendStatusReportUpdateMock.restore();
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

    assertSpyCalls(sendPageSubscriptionMock, 1);
    const [args] = sendPageSubscriptionMock.calls[0].args;
    expect(args.to).toBe("user@example.com");
    expect(args.link).toBe("https://example.com/verify/abc");
    expect(args.page).toBe("My Page");
  });
});

// ─── sendEmailNotifications ───────────────────────────────────────────────────

describe("sendEmailNotifications", () => {
  test("does nothing for an empty subscriptions array", async () => {
    await sendEmailNotifications([], makeUpdate());
    assertSpyCalls(sendStatusReportUpdateMock, 0);
  });

  test("filters out subscriptions without an email address", async () => {
    const sub = makeSub({ email: undefined });
    await sendEmailNotifications([sub], makeUpdate());
    assertSpyCalls(sendStatusReportUpdateMock, 0);
  });

  test("calls sendStatusReportUpdate once with all valid subscribers", async () => {
    const sub1 = makeSub({ email: "a@example.com", token: "token-a" });
    const sub2 = makeSub({ email: "b@example.com", token: "token-b" });
    const update = makeUpdate({ title: "Outage", status: "resolved" });

    await sendEmailNotifications([sub1, sub2], update);

    assertSpyCalls(sendStatusReportUpdateMock, 1);
    const [args] = sendStatusReportUpdateMock.calls[0].args;
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

    const [args] = sendStatusReportUpdateMock.calls[0].args;
    expect(args.pageComponents).toEqual(["API", "Database"]);
  });

  test("derives the idempotency key from the status-report update id", async () => {
    const sub = makeSub();
    await sendEmailNotifications([sub], makeUpdate({ updateId: 77 }));

    const [args] = sendStatusReportUpdateMock.calls[0].args;
    expect(args.idempotencyKey).toMatch(/^status-report-update:77:[0-9a-z]+$/);
  });

  test("falls back to a page-update key when there is no update id (maintenance)", async () => {
    const sub = makeSub();
    await sendEmailNotifications(
      [sub],
      makeUpdate({ id: 17, updateId: undefined, status: "maintenance" }),
    );

    const [args] = sendStatusReportUpdateMock.calls[0].args;
    expect(args.idempotencyKey).toMatch(
      /^page-update:17:maintenance:[0-9a-z]+$/,
    );
  });

  test("keeps the same key for an identical re-dispatch", async () => {
    const update = makeUpdate({ updateId: 77, date: "2026-07-16T11:00:00Z" });
    await sendEmailNotifications([makeSub()], update);
    await sendEmailNotifications([makeSub()], update);

    const keys = sendStatusReportUpdateMock.calls.map(
      (c) => c.args[0].idempotencyKey,
    );
    expect(keys[0]).toBe(keys[1]);
  });

  test("changes the key when the subscriber list changes", async () => {
    const update = makeUpdate({ updateId: 77, date: "2026-07-16T11:00:00Z" });
    await sendEmailNotifications([makeSub()], update);
    await sendEmailNotifications(
      [makeSub(), makeSub({ id: 2, email: "b@example.com", token: "token-b" })],
      update,
    );

    const keys = sendStatusReportUpdateMock.calls.map(
      (c) => c.args[0].idempotencyKey,
    );
    expect(keys[0]).not.toBe(keys[1]);
  });

  test("changes the key when the update content changes", async () => {
    const date = "2026-07-16T11:00:00Z";
    await sendEmailNotifications(
      [makeSub()],
      makeUpdate({ updateId: 77, date, message: "We are investigating." }),
    );
    await sendEmailNotifications(
      [makeSub()],
      makeUpdate({ updateId: 77, date, message: "Root cause identified." }),
    );

    const keys = sendStatusReportUpdateMock.calls.map(
      (c) => c.args[0].idempotencyKey,
    );
    expect(keys[0]).not.toBe(keys[1]);
  });
});
