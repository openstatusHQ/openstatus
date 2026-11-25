import "./test-preload.ts";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import { EmailClient } from "./client";

function makeSubscribers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    email: `user-${i}@example.com`,
    token: `token-${i}`,
  }));
}

function baseReq(
  overrides: Partial<Parameters<EmailClient["sendPageUpdate"]>[0]> = {},
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

describe("EmailClient.sendPageUpdate - idempotency & chunking", () => {
  let client: EmailClient;
  // biome-ignore lint/suspicious/noExplicitAny: stub over the Resend batch method
  let batchSend: MockInstance;

  beforeEach(() => {
    // zero backoff so the retry test doesn't wait on the real exponential sleep
    client = new EmailClient({
      apiKey: "re_test_123",
      retryBackoff: "0 millis",
    });
    batchSend = vi
      .spyOn(client.client.batch, "send")
      .mockImplementation(() => Promise.resolve(ok));
  });

  afterEach(() => {
    batchSend.mockRestore();
  });

  test("passes the base idempotency key suffixed with the batch index", async () => {
    await client.sendPageUpdate(
      baseReq({ idempotencyKey: "status-report-update:5" }),
    );

    expect(batchSend).toHaveBeenCalledTimes(1);
    const options = batchSend.mock.calls[0][1];
    expect(options).toEqual({ idempotencyKey: "status-report-update:5:0" });
  });

  test("gives each 100-recipient chunk a distinct key and its own slice", async () => {
    await client.sendPageUpdate(
      baseReq({
        subscribers: makeSubscribers(250),
        idempotencyKey: "status-report-update:9",
      }),
    );

    expect(batchSend).toHaveBeenCalledTimes(3);
    const keys = batchSend.mock.calls.map((c) => c[1]?.idempotencyKey);
    expect(keys).toEqual([
      "status-report-update:9:0",
      "status-report-update:9:1",
      "status-report-update:9:2",
    ]);
    const sizes = batchSend.mock.calls.map((c) => c[0].length);
    expect(sizes).toEqual([100, 100, 50]);
  });

  test("omits the option entirely when no base key is provided", async () => {
    await client.sendPageUpdate(baseReq());

    const options = batchSend.mock.calls[0][1];
    expect(options).toBeUndefined();
  });

  test("reuses the same key across a retry so Resend dedupes the resend", async () => {
    batchSend.mockRestore();
    batchSend = vi
      .spyOn(client.client.batch, "send")
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(ok);

    await client.sendPageUpdate(
      baseReq({ idempotencyKey: "status-report-update:7" }),
    );

    // failure → retry: the second attempt must carry the identical key, or
    // Resend would treat the retry as a fresh batch and double-send.
    expect(batchSend).toHaveBeenCalledTimes(2);
    const keys = batchSend.mock.calls.map((c) => c[1]?.idempotencyKey);
    expect(keys).toEqual([
      "status-report-update:7:0",
      "status-report-update:7:0",
    ]);
  });

  test("does not retry a deterministic idempotency conflict", async () => {
    batchSend.mockRestore();
    batchSend = vi
      .spyOn(client.client.batch, "send")
      .mockImplementation(() => Promise.resolve(idempotencyConflict));

    await client.sendPageUpdate(
      baseReq({ idempotencyKey: "status-report-update:7" }),
    );

    // a 409 invalid_idempotent_request replays identically on every attempt;
    // retrying only re-logs the same error.
    expect(batchSend).toHaveBeenCalledTimes(1);
  });
});

describe("EmailClient.sendMonitorAlert", () => {
  let client: EmailClient;
  // biome-ignore lint/suspicious/noExplicitAny: stub over the Resend send method
  let send: MockInstance;

  beforeEach(() => {
    client = new EmailClient({ apiKey: "re_test_123" });
    send = vi
      .spyOn(client.client.emails, "send")
      .mockImplementation(() => Promise.resolve(ok));
  });

  afterEach(() => {
    send.mockRestore();
  });

  const req = {
    to: "ping@openstatus.dev",
    type: "degraded" as const,
    monitorId: 42,
    name: "Ping Pong",
    url: "https://openstatus.dev/ping",
    status: "200",
    latency: "300 ms",
    region: "Amsterdam, Netherlands",
    degradedAfter: 250,
  };

  test("sends the rendered template from the system sender", async () => {
    await client.sendMonitorAlert(req);

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.to).toBe("ping@openstatus.dev");
    expect(payload.from).toBe(
      "openstatus <notifications@notifications.openstatus.dev>",
    );
    expect(payload.replyTo).toBe("ping@openstatus.dev");
    expect(payload.subject).toBe(
      "Ping Pong is slow — 300 ms from Amsterdam, Netherlands",
    );
    expect(payload.html).toContain("Ping Pong is answering slowly");
    expect(payload.html).toContain("threshold 250 ms");
    expect(payload.html).toContain("https://app.openstatus.dev/monitors/42");
  });

  test("rethrows a Resend error so the outbox can retry", async () => {
    send.mockRestore();
    send = vi
      .spyOn(client.client.emails, "send")
      .mockImplementation(() => Promise.resolve(fail));

    await expect(client.sendMonitorAlert(req)).rejects.toEqual({
      name: "application_error",
    });
  });
});

describe("EmailClient.sendPrivateLocationAlert", () => {
  let client: EmailClient;
  // biome-ignore lint/suspicious/noExplicitAny: stub over the Resend batch method
  let batchSend: MockInstance;

  beforeEach(() => {
    client = new EmailClient({ apiKey: "re_test_123" });
    batchSend = vi
      .spyOn(client.client.batch, "send")
      .mockImplementation(() => Promise.resolve(ok));
  });

  afterEach(() => {
    batchSend.mockRestore();
  });

  const req = {
    to: ["a@example.com", "b@example.com"],
    locationName: "eu-west-private",
    status: "error" as const,
    lastSeenAt: new Date("2026-07-23T10:00:00Z"),
    monitorCount: 4,
  };

  test("sends one mail per member with subject, sender and body", async () => {
    await client.sendPrivateLocationAlert(req);

    expect(batchSend).toHaveBeenCalledTimes(1);
    const emails = batchSend.mock.calls[0][0];
    expect(emails.map((e: { to: string }) => e.to)).toEqual(req.to);
    expect(emails[0].from).toBe(
      "openstatus <notifications@notifications.openstatus.dev>",
    );
    expect(emails[0].subject).toBe(
      'Checks paused — "eu-west-private" stopped reporting',
    );
    expect(emails[0].html).toContain("4 monitors");
    expect(emails[0].html).toContain("23 Jul, 10:00 UTC");
  });

  test("does nothing without recipients", async () => {
    await client.sendPrivateLocationAlert({ ...req, to: [] });
    expect(batchSend).toHaveBeenCalledTimes(0);
  });

  test("swallows a non rate-limit failure", async () => {
    batchSend.mockRestore();
    batchSend = vi
      .spyOn(client.client.batch, "send")
      .mockImplementation(() => Promise.resolve(fail));
    await client.sendPrivateLocationAlert(req);
    expect(batchSend).toHaveBeenCalledTimes(1);
  });
});
