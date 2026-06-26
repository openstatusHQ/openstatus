import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { EmailClient } from "./client";

// sendStatusReportUpdate early-returns in development; force the real send path.
process.env.NODE_ENV = "test";

function makeSubscribers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    email: `user-${i}@example.com`,
    token: `token-${i}`,
  }));
}

function baseReq(
  overrides: Partial<Parameters<EmailClient["sendStatusReportUpdate"]>[0]> = {},
) {
  return {
    subscribers: makeSubscribers(1),
    pageSlug: "demo",
    pageTitle: "Demo",
    reportTitle: "Outage",
    status: "investigating" as const,
    date: "2026-04-21T09:59:58Z",
    message: "We are investigating.",
    pageComponents: [] as string[],
    ...overrides,
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test doubles for the Resend batch result
const ok = { data: { data: [] }, error: null } as any;
// biome-ignore lint/suspicious/noExplicitAny: simulated Resend application error
const fail = { data: null, error: { name: "application_error" } } as any;

describe("EmailClient.sendStatusReportUpdate - idempotency & chunking", () => {
  let client: EmailClient;
  // biome-ignore lint/suspicious/noExplicitAny: bun spy handle
  let batchSend: any;

  beforeEach(() => {
    // zero backoff so the retry test doesn't wait on the real exponential sleep
    client = new EmailClient({
      apiKey: "re_test_123",
      retryBackoff: "0 millis",
    });
    batchSend = spyOn(client.client.batch, "send").mockResolvedValue(ok);
  });

  afterEach(() => {
    batchSend.mockRestore();
  });

  test("passes the base idempotency key suffixed with the batch index", async () => {
    await client.sendStatusReportUpdate(
      baseReq({ idempotencyKey: "status-report-update:5" }),
    );

    expect(batchSend).toHaveBeenCalledTimes(1);
    const [, options] = batchSend.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: "status-report-update:5:0" });
  });

  test("gives each 100-recipient chunk a distinct key and its own slice", async () => {
    await client.sendStatusReportUpdate(
      baseReq({
        subscribers: makeSubscribers(250),
        idempotencyKey: "status-report-update:9",
      }),
    );

    expect(batchSend).toHaveBeenCalledTimes(3);
    const keys = batchSend.mock.calls.map(
      // biome-ignore lint/suspicious/noExplicitAny: positional spy args
      ([, o]: [unknown, any]) => o?.idempotencyKey,
    );
    expect(keys).toEqual([
      "status-report-update:9:0",
      "status-report-update:9:1",
      "status-report-update:9:2",
    ]);
    const sizes = batchSend.mock.calls.map(
      // biome-ignore lint/suspicious/noExplicitAny: positional spy args
      ([payload]: [any[]]) => payload.length,
    );
    expect(sizes).toEqual([100, 100, 50]);
  });

  test("omits the option entirely when no base key is provided", async () => {
    await client.sendStatusReportUpdate(baseReq());

    const [, options] = batchSend.mock.calls[0];
    expect(options).toBeUndefined();
  });

  test("reuses the same key across a retry so Resend dedupes the resend", async () => {
    batchSend.mockResolvedValueOnce(fail).mockResolvedValueOnce(ok);

    await client.sendStatusReportUpdate(
      baseReq({ idempotencyKey: "status-report-update:7" }),
    );

    // failure → retry: the second attempt must carry the identical key, or
    // Resend would treat the retry as a fresh batch and double-send.
    expect(batchSend).toHaveBeenCalledTimes(2);
    const keys = batchSend.mock.calls.map(
      // biome-ignore lint/suspicious/noExplicitAny: positional spy args
      ([, o]: [unknown, any]) => o?.idempotencyKey,
    );
    expect(keys).toEqual([
      "status-report-update:7:0",
      "status-report-update:7:0",
    ]);
  });
});
