import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import {
  assertSpyCalls,
  returnsNext,
  type Stub,
  stub,
} from "@std/testing/mock";

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
// biome-ignore lint/suspicious/noExplicitAny: simulated Resend 409 conflict
const idempotencyConflict = {
  data: null,
  error: { name: "invalid_idempotent_request" },
} as any;

describe("EmailClient.sendStatusReportUpdate - idempotency & chunking", () => {
  let client: EmailClient;
  // biome-ignore lint/suspicious/noExplicitAny: stub over the Resend batch method
  let batchSend: Stub<any>;

  beforeEach(() => {
    // zero backoff so the retry test doesn't wait on the real exponential sleep
    client = new EmailClient({
      apiKey: "re_test_123",
      retryBackoff: "0 millis",
    });
    batchSend = stub(client.client.batch, "send", () => Promise.resolve(ok));
  });

  afterEach(() => {
    batchSend.restore();
  });

  test("passes the base idempotency key suffixed with the batch index", async () => {
    await client.sendStatusReportUpdate(
      baseReq({ idempotencyKey: "status-report-update:5" }),
    );

    assertSpyCalls(batchSend, 1);
    const options = batchSend.calls[0].args[1];
    expect(options).toEqual({ idempotencyKey: "status-report-update:5:0" });
  });

  test("gives each 100-recipient chunk a distinct key and its own slice", async () => {
    await client.sendStatusReportUpdate(
      baseReq({
        subscribers: makeSubscribers(250),
        idempotencyKey: "status-report-update:9",
      }),
    );

    assertSpyCalls(batchSend, 3);
    const keys = batchSend.calls.map((c) => c.args[1]?.idempotencyKey);
    expect(keys).toEqual([
      "status-report-update:9:0",
      "status-report-update:9:1",
      "status-report-update:9:2",
    ]);
    const sizes = batchSend.calls.map((c) => c.args[0].length);
    expect(sizes).toEqual([100, 100, 50]);
  });

  test("omits the option entirely when no base key is provided", async () => {
    await client.sendStatusReportUpdate(baseReq());

    const options = batchSend.calls[0].args[1];
    expect(options).toBeUndefined();
  });

  test("reuses the same key across a retry so Resend dedupes the resend", async () => {
    batchSend.restore();
    batchSend = stub(
      client.client.batch,
      "send",
      returnsNext([Promise.resolve(fail), Promise.resolve(ok)]),
    );

    await client.sendStatusReportUpdate(
      baseReq({ idempotencyKey: "status-report-update:7" }),
    );

    // failure → retry: the second attempt must carry the identical key, or
    // Resend would treat the retry as a fresh batch and double-send.
    assertSpyCalls(batchSend, 2);
    const keys = batchSend.calls.map((c) => c.args[1]?.idempotencyKey);
    expect(keys).toEqual([
      "status-report-update:7:0",
      "status-report-update:7:0",
    ]);
  });

  test("does not retry a deterministic idempotency conflict", async () => {
    batchSend.restore();
    batchSend = stub(client.client.batch, "send", () =>
      Promise.resolve(idempotencyConflict),
    );

    await client.sendStatusReportUpdate(
      baseReq({ idempotencyKey: "status-report-update:7" }),
    );

    // a 409 invalid_idempotent_request replays identically on every attempt;
    // retrying only re-logs the same error.
    assertSpyCalls(batchSend, 1);
  });
});
