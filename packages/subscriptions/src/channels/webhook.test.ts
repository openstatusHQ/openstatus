import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { PageUpdate, Subscription } from "../types";
import {
  sendWebhookNotifications,
  sendWebhookVerification,
  validateWebhookConfig,
} from "./webhook";

// biome-ignore lint/suspicious/noExplicitAny: test spy
let fetchMock: any;

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    pageId: 1,
    pageName: "Test Page",
    pageSlug: "test",
    channelType: "webhook",
    webhookUrl: "https://example.com/webhook",
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
    const sub1 = makeSub({ webhookUrl: "https://hook1.example.com" });
    const sub2 = makeSub({ webhookUrl: "https://hook2.example.com" });

    await sendWebhookNotifications([sub1, sub2], makeUpdate());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([url]: [string]) => url);
    expect(urls).toContain("https://hook1.example.com");
    expect(urls).toContain("https://hook2.example.com");
  });

  test("sends the correct payload shape", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const sub = makeSub({ pageId: 42, pageName: "My Page" });
    const update = makeUpdate({
      title: "Outage",
      status: "resolved",
      pageComponents: ["API"],
    });

    await sendWebhookNotifications([sub], update);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.type).toBe("page_update");
    expect(body.page.id).toBe(42);
    expect(body.page.name).toBe("My Page");
    expect(body.update.status).toBe("resolved");
    expect(body.update.title).toBe("Outage");
    expect(body.update.pageComponents).toEqual(["API"]);
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
