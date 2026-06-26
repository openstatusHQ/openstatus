import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { webhookPayloadSchema } from "../payload";
import type { PageUpdate, Subscription } from "../types";
import {
  buildGenericPayload,
  buildTestPayload,
  detectWebhookFlavor,
  sendTestWebhookRequest,
  sendWebhookNotifications,
  sendWebhookVerification,
  validateWebhookConfig,
} from "./webhook";

const SLACK_URL = "https://hooks.slack.com/services/T1/B1/XXX";
const DISCORD_URL = "https://discord.com/api/webhooks/1/xxx";

let fetchMock: any;

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    pageId: 1,
    pageName: "Test Page",
    pageSlug: "test",
    channelType: "webhook",
    webhookUrl: SLACK_URL,
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
    pageComponents: ["API", "Database"],
    date: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock = spyOn(global, "fetch");
});

afterEach(() => {
  fetchMock.mockRestore();
});

// ─── validateWebhookConfig ────────────────────────────────────────────────────

describe("validateWebhookConfig", () => {
  test("returns valid for an empty config", async () => {
    const result = await validateWebhookConfig({});
    expect(result.valid).toBe(true);
  });

  test("returns valid with optional headers and secret", async () => {
    const result = await validateWebhookConfig({
      headers: [{ key: "Authorization", value: "Bearer token" }],
      secret: "my-secret",
    });
    expect(result.valid).toBe(true);
  });

  test("returns invalid when a header is missing a key", async () => {
    const result = await validateWebhookConfig({
      headers: [{ key: "", value: "v" }], // key must be min length 1
    });
    expect(result.valid).toBe(false);
  });

  test("returns invalid for a non-object value", async () => {
    const result = await validateWebhookConfig("not-an-object");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("returns valid with only headers", async () => {
    const result = await validateWebhookConfig({ headers: [] });
    expect(result.valid).toBe(true);
  });
});

// ─── sendWebhookVerification ──────────────────────────────────────────────────

describe("sendWebhookVerification", () => {
  test("throws when subscription has no webhookUrl", async () => {
    const sub = makeSub({ webhookUrl: undefined });
    await expect(
      sendWebhookVerification(sub, "https://example.com/verify/token"),
    ).rejects.toThrow("Webhook URL is required");
  });

  test("resolves when fetch returns 200", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub();
    await expect(
      sendWebhookVerification(sub, "https://example.com/verify/abc"),
    ).resolves.toBeUndefined();
  });

  test("throws when fetch returns a non-ok status", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 500, statusText: "Server Error" }),
    );
    const sub = makeSub();
    await expect(
      sendWebhookVerification(sub, "https://example.com/verify/abc"),
    ).rejects.toThrow("Webhook verification failed: 500");
  });

  test("posts to the correct URL with the expected payload", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({
      token: "my-token",
      webhookUrl: "https://hooks.example.com/sub",
    });
    await sendWebhookVerification(sub, "https://example.com/verify/my-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/sub");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.type).toBe("verification");
    expect(body.token).toBe("my-token");
    expect(body.verifyUrl).toBe("https://example.com/verify/my-token");
  });
});

// ─── sendWebhookNotifications ─────────────────────────────────────────────────

describe("sendWebhookNotifications", () => {
  test("skips subscriptions without a webhookUrl", async () => {
    const sub = makeSub({ webhookUrl: undefined });
    await sendWebhookNotifications([sub], makeUpdate());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sends a POST request to each webhook URL", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub1 = makeSub({
      webhookUrl: "https://hooks.slack.com/services/T1/B1/aaa",
    });
    const sub2 = makeSub({
      webhookUrl: "https://hooks.slack.com/services/T2/B2/bbb",
    });

    await sendWebhookNotifications([sub1, sub2], makeUpdate());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([url]: [string]) => url);
    expect(urls).toContain("https://hooks.slack.com/services/T1/B1/aaa");
    expect(urls).toContain("https://hooks.slack.com/services/T2/B2/bbb");
  });

  test("sends a generic JSON payload to non-Slack/Discord URLs", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const generic = makeSub({
      id: 101,
      webhookUrl: "https://example.com/webhook",
    });
    const slack = makeSub({ id: 102, webhookUrl: SLACK_URL });

    await sendWebhookNotifications(
      [generic, slack],
      makeUpdate({ updateId: 42 }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const byUrl = new Map<string, any>(
      fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => [
        url,
        JSON.parse(init.body as string),
      ]),
    );
    expect(byUrl.get("https://example.com/webhook").type).toBe("status_report");
    expect(byUrl.get(SLACK_URL).attachments).toBeDefined();
  });

  test("the status_report body sent over the wire satisfies webhookPayloadSchema (v1)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({ webhookUrl: "https://example.com/webhook" });

    await sendWebhookNotifications(
      [sub],
      makeUpdate({
        status: "investigating",
        updateId: 42,
        componentsWithImpact: [
          { id: 7, name: "API", impact: "partial_outage" },
        ],
      }),
    );

    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init?.body as string);
    const result = webhookPayloadSchema.safeParse(sentBody);
    expect(result.success).toBe(true);
  });

  test("the maintenance body sent over the wire satisfies webhookPayloadSchema (v1)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({ webhookUrl: "https://example.com/webhook" });

    await sendWebhookNotifications(
      [sub],
      makeUpdate({
        status: "maintenance",
        startsAt: "2026-04-22T02:00:00Z",
        endsAt: "2026-04-22T03:00:00Z",
        pageComponentsWithId: [{ id: 7, name: "API" }],
      }),
    );

    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init?.body as string);
    const result = webhookPayloadSchema.safeParse(sentBody);
    expect(result.success).toBe(true);
  });

  test("applies custom headers from channelConfig", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({
      channelConfig: JSON.stringify({
        headers: [{ key: "X-Custom-Header", value: "my-value" }],
      }),
    });

    await sendWebhookNotifications([sub], makeUpdate());

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Custom-Header"]).toBe("my-value");
  });

  test("continues sending to remaining webhooks when one keeps failing", async () => {
    const failUrl = "https://hooks.slack.com/services/T1/B1/fail";
    fetchMock.mockImplementation(async (url: string) =>
      url === failUrl
        ? Promise.reject(new Error("Network error"))
        : new Response(null, { status: 200 }),
    );

    const sub1 = makeSub({ webhookUrl: failUrl });
    const sub2 = makeSub({
      webhookUrl: "https://hooks.slack.com/services/T2/B2/succeed",
    });

    await expect(
      sendWebhookNotifications([sub1, sub2], makeUpdate()),
    ).resolves.toBeUndefined();

    const calls = fetchMock.mock.calls.map(([url]: [string]) => url);
    expect(calls).toContain("https://hooks.slack.com/services/T2/B2/succeed");
  });

  test("retries transient failures then succeeds", async () => {
    let attempts = 0;
    fetchMock.mockImplementation(async () => {
      attempts += 1;
      return attempts < 3
        ? new Response(null, { status: 503, statusText: "Service Unavailable" })
        : new Response(null, { status: 200 });
    });

    await expect(
      sendWebhookNotifications([makeSub()], makeUpdate()),
    ).resolves.toBeUndefined();

    expect(attempts).toBe(3);
  });

  test("does not retry non-retryable 4xx responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 400, statusText: "Bad Request" }),
    );

    await sendWebhookNotifications([makeSub()], makeUpdate());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─── detectWebhookFlavor ──────────────────────────────────────────────────────

describe("detectWebhookFlavor", () => {
  test("detects Slack incoming webhook URLs", () => {
    expect(
      detectWebhookFlavor("https://hooks.slack.com/services/T00/B00/XXX"),
    ).toBe("slack");
  });

  test("detects Discord webhook URLs", () => {
    expect(
      detectWebhookFlavor("https://discord.com/api/webhooks/123/abc"),
    ).toBe("discord");
  });

  test("falls back to generic for unknown hosts", () => {
    expect(detectWebhookFlavor("https://example.com/webhook")).toBe("generic");
  });
});

// ─── flavor-specific notification payloads ────────────────────────────────────

describe("sendWebhookNotifications (flavor detection)", () => {
  test("emits Slack blocks payload for hooks.slack.com URLs", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({ webhookUrl: SLACK_URL });

    await sendWebhookNotifications([sub], makeUpdate());

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].blocks).toBeInstanceOf(Array);
  });

  test("emits Discord embed payload for discord.com URLs", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({ webhookUrl: DISCORD_URL });

    await sendWebhookNotifications([sub], makeUpdate());

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.embeds).toBeInstanceOf(Array);
    expect(body.embeds[0].title).toBe("Test Incident");
  });

  test("Slack payload includes manage/unsubscribe links", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({
      token: "tok-123",
      pageSlug: "demo",
    });

    await sendWebhookNotifications([sub], makeUpdate());

    const [, init] = fetchMock.mock.calls[0];
    const stringified = init?.body as string;
    expect(stringified).toContain("https://demo.openstatus.dev/manage/tok-123");
    expect(stringified).toContain(
      "https://demo.openstatus.dev/unsubscribe/tok-123",
    );
  });

  test("Slack payload uses custom domain when present", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({
      token: "tok-123",
      customDomain: "status.partner.com",
    });

    await sendWebhookNotifications([sub], makeUpdate());

    const [, init] = fetchMock.mock.calls[0];
    const stringified = init?.body as string;
    expect(stringified).toContain("https://status.partner.com/manage/tok-123");
  });

  test("Slack payload links to the event details and the page origin", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({ pageSlug: "demo", pageName: "Demo" });

    await sendWebhookNotifications([sub], makeUpdate({ id: 99 }));

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    const stringified = init?.body as string;
    // title stays in a plain_text header block
    expect(body.attachments[0].blocks[0]).toMatchObject({
      type: "header",
      text: { type: "plain_text", text: "Test Incident" },
    });
    expect(stringified).toContain(
      "<https://demo.openstatus.dev/events/report/99|View details>",
    );
    expect(stringified).toContain("<https://demo.openstatus.dev|Demo>");
  });

  test("Discord embed url points at the event; maintenance uses the maintenance path", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({
      webhookUrl: DISCORD_URL,
      pageSlug: "demo",
      pageName: "Demo",
    });

    await sendWebhookNotifications(
      [sub],
      makeUpdate({ id: 7, status: "maintenance" }),
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.embeds[0].url).toBe(
      "https://demo.openstatus.dev/events/maintenance/7",
    );
    expect(body.embeds[0].fields[1].value).toBe(
      "[Demo](https://demo.openstatus.dev)",
    );
  });
});

// ─── buildGenericPayload (staged, not yet reachable in production) ────────────

describe("buildGenericPayload", () => {
  const links = {
    manageUrl: "https://demo.openstatus.dev/manage/tok-1",
    unsubscribeUrl: "https://demo.openstatus.dev/unsubscribe/tok-1",
  };

  test("status_report shape", () => {
    const sub = makeSub({ pageId: 42, pageName: "Acme", pageSlug: "acme" });
    const update = makeUpdate({
      id: 12,
      title: "API degraded",
      status: "investigating",
      message: "Looking into it.",
      date: "2026-04-21T09:59:58Z",
      updateId: 42,
      componentsWithImpact: [
        { id: 7, name: "API", impact: "major_outage" },
        {
          id: 8,
          name: "Dashboard",
          impact: "degraded_performance",
        },
      ],
    });

    const payload = buildGenericPayload(update, sub, links) as {
      version: string;
      type: string;
      data: { status_report: Record<string, unknown> };
      subscription: { manage_url: string; unsubscribe_url: string };
    };

    expect(payload.version).toBe("1");
    expect(payload.type).toBe("status_report");
    expect(payload.data.status_report).toMatchObject({
      id: 12,
      title: "API degraded",
      url: "https://acme.openstatus.dev/events/report/12",
      update: {
        id: 42,
        status: "investigating",
        message: "Looking into it.",
        occurred_at: "2026-04-21T09:59:58Z",
      },
      page: {
        id: 42,
        name: "Acme",
        slug: "acme",
        url: "https://acme.openstatus.dev",
      },
      components: [
        { id: 7, name: "API", impact: "major_outage" },
        {
          id: 8,
          name: "Dashboard",
          impact: "degraded_performance",
        },
      ],
    });
    expect(payload.subscription).toEqual({
      manage_url: links.manageUrl,
      unsubscribe_url: links.unsubscribeUrl,
    });
  });

  test("maintenance shape (no status field, includes starts_at/ends_at)", () => {
    const sub = makeSub({ pageId: 42, pageName: "Acme", pageSlug: "acme" });
    const update = makeUpdate({
      id: 17,
      title: "DB upgrade",
      status: "maintenance",
      message: "Rolling primary.",
      startsAt: "2026-04-22T02:00:00Z",
      endsAt: "2026-04-22T03:00:00Z",
      pageComponentsWithId: [{ id: 7, name: "API" }],
    });

    const payload = buildGenericPayload(update, sub, links) as {
      version: string;
      type: string;
      data: { maintenance: Record<string, unknown> };
    };

    expect(payload.version).toBe("1");
    expect(payload.type).toBe("maintenance");
    expect(payload.data.maintenance).toMatchObject({
      id: 17,
      title: "DB upgrade",
      url: "https://acme.openstatus.dev/events/maintenance/17",
      message: "Rolling primary.",
      starts_at: "2026-04-22T02:00:00Z",
      ends_at: "2026-04-22T03:00:00Z",
      page: {
        id: 42,
        name: "Acme",
        slug: "acme",
        url: "https://acme.openstatus.dev",
      },
      // maintenance has no per-component impact: falls back to operational
      components: [{ id: 7, name: "API", impact: "operational" }],
    });
    expect(payload.data.maintenance).not.toHaveProperty("status");
  });

  test("output satisfies the canonical webhookPayloadSchema contract", () => {
    const sub = makeSub({ pageId: 42, pageName: "Acme", pageSlug: "acme" });
    const report = buildGenericPayload(
      makeUpdate({
        id: 12,
        status: "investigating",
        updateId: 42,
        componentsWithImpact: [
          { id: 7, name: "API", impact: "partial_outage" },
        ],
      }),
      sub,
      links,
    );
    const maintenance = buildGenericPayload(
      makeUpdate({
        id: 17,
        status: "maintenance",
        startsAt: "2026-04-22T02:00:00Z",
        endsAt: "2026-04-22T03:00:00Z",
        pageComponentsWithId: [{ id: 7, name: "API" }],
      }),
      sub,
      links,
    );

    expect(webhookPayloadSchema.safeParse(report).success).toBe(true);
    expect(webhookPayloadSchema.safeParse(maintenance).success).toBe(true);
  });
});

// ─── buildTestPayload ─────────────────────────────────────────────────────────

describe("buildTestPayload", () => {
  test("Slack flavor returns attachments with blocks", () => {
    const payload = buildTestPayload("slack") as { attachments: unknown[] };
    expect(payload.attachments).toBeInstanceOf(Array);
  });

  test("Discord flavor returns embeds", () => {
    const payload = buildTestPayload("discord") as { embeds: unknown[] };
    expect(payload.embeds).toBeInstanceOf(Array);
  });

  test("generic flavor returns enveloped type='test' JSON", () => {
    const payload = buildTestPayload("generic") as {
      version: string;
      type: string;
      data: { test: { message: string; timestamp: string } };
    };
    expect(payload.version).toBe("1");
    expect(payload.type).toBe("test");
    expect(typeof payload.data.test.message).toBe("string");
    expect(typeof payload.data.test.timestamp).toBe("string");
  });

  test("generic output satisfies the canonical webhookPayloadSchema contract", () => {
    expect(
      webhookPayloadSchema.safeParse(buildTestPayload("generic")).success,
    ).toBe(true);
  });
});

// ─── sendTestWebhookRequest ───────────────────────────────────────────────────

describe("sendTestWebhookRequest", () => {
  test("POSTs flavor-appropriate payload", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await sendTestWebhookRequest({
      url: "https://example.com/hook",
      flavor: "generic",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/hook");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.type).toBe("test");
  });

  test("throws on non-2xx response", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" }),
    );
    await expect(
      sendTestWebhookRequest({
        url: "https://example.com/hook",
        flavor: "generic",
      }),
    ).rejects.toThrow(/Test webhook failed: 404/);
  });

  test("passes custom headers", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await sendTestWebhookRequest({
      url: "https://example.com/hook",
      flavor: "generic",
      headers: { "X-Custom": "abc" },
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Custom"]).toBe("abc");
  });
});
