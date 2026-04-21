import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
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

// biome-ignore lint/suspicious/noExplicitAny: test spy
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

  test("drops subscriptions with non-Slack/Discord URLs", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const generic = makeSub({
      id: 101,
      webhookUrl: "https://example.com/webhook",
    });
    const slack = makeSub({ id: 102, webhookUrl: SLACK_URL });

    await sendWebhookNotifications([generic, slack], makeUpdate());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(SLACK_URL);
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

  test("continues sending to remaining webhooks when one fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const sub1 = makeSub({ webhookUrl: "https://fail.example.com" });
    const sub2 = makeSub({ webhookUrl: "https://succeed.example.com" });

    await expect(
      sendWebhookNotifications([sub1, sub2], makeUpdate()),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
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
      pageComponentsWithId: [{ id: 7, name: "API" }],
    });

    const payload = buildGenericPayload(update, sub, links) as {
      type: string;
      data: { status_report: Record<string, unknown> };
      subscription: { manage_url: string; unsubscribe_url: string };
    };

    expect(payload.type).toBe("status_report");
    expect(payload.data.status_report).toMatchObject({
      id: 12,
      title: "API degraded",
      update: {
        id: 42,
        status: "investigating",
        message: "Looking into it.",
        created_at: "2026-04-21T09:59:58Z",
      },
      page: { id: 42, name: "Acme", slug: "acme" },
      components: [{ id: 7, name: "API" }],
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
      type: string;
      data: { maintenance: Record<string, unknown> };
    };

    expect(payload.type).toBe("maintenance");
    expect(payload.data.maintenance).toMatchObject({
      id: 17,
      title: "DB upgrade",
      message: "Rolling primary.",
      starts_at: "2026-04-22T02:00:00Z",
      ends_at: "2026-04-22T03:00:00Z",
      page: { id: 42, name: "Acme", slug: "acme" },
      components: [{ id: 7, name: "API" }],
    });
    expect(payload.data.maintenance).not.toHaveProperty("status");
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

  test("generic flavor returns type='test' JSON", () => {
    const payload = buildTestPayload("generic") as {
      type: string;
      message: string;
    };
    expect(payload.type).toBe("test");
    expect(typeof payload.message).toBe("string");
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
