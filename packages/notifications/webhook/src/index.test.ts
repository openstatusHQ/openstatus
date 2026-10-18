import type { NotificationContext } from "@openstatus/notification-base";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, stub, type Stub } from "@std/testing/mock";

import {
  DEFAULT_TIMEOUT_MS,
  sendAlert,
  sendDegraded,
  sendRecovery,
  sendTest,
} from "./index";

describe("Webhook sendTest", () => {
  let fetchMock: Stub<typeof globalThis>;

  beforeEach(() => {
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test("should send test webhook successfully", async () => {
    const url = "https://example.com/webhook";
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    const result = await sendTest({ url });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    expect(fetchMock.calls[0].args[0]).toBe(url);
    expect(fetchMock.calls[0].args[1]).toEqual(
      expect.objectContaining({
        method: "post",
        body: expect.any(String),
        headers: { "Content-Type": "application/json" },
      }),
    );

    const callArgs = fetchMock.calls[0].args;
    const body = JSON.parse(callArgs[1].body);
    expect(body).toMatchObject({
      monitor: {
        id: 1,
        name: "test",
        url: "http://openstat.us",
      },
      status: "recovered",
      statusCode: 200,
      latency: 1337,
    });
    expect(typeof body.cronTimestamp).toBe("number");
  });

  test("should send test webhook with headers", async () => {
    const url = "https://example.com/webhook";
    const headers = [
      { key: "Authorization", value: "Bearer token123" },
      { key: "Content-Type", value: "application/json" },
    ];
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    const result = await sendTest({ url, headers });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    expect(fetchMock.calls[0].args[0]).toBe(url);
    expect(fetchMock.calls[0].args[1]).toEqual(
      expect.objectContaining({
        method: "post",
        body: expect.any(String),
        headers: {
          Authorization: "Bearer token123",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  test("should throw error when response is not ok", async () => {
    const url = "https://example.com/webhook";
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 400 })),
    );

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    assertSpyCalls(fetchMock, 1);
  });

  test("should throw error when fetch fails", async () => {
    const url = "https://example.com/webhook";
    const networkError = new Error("Network error");
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () => Promise.reject(networkError));

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    assertSpyCalls(fetchMock, 1);
  });

  test("should send test webhook with empty headers array", async () => {
    const url = "https://example.com/webhook";
    const headers: { key: string; value: string }[] = [];
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    const result = await sendTest({ url, headers });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    // Empty headers array should still include Content-Type
    expect(callArgs[1].headers).toEqual({ "Content-Type": "application/json" });
  });

  test("should send test webhook with 500 status code", async () => {
    const url = "https://example.com/webhook";
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 500 })),
    );

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    assertSpyCalls(fetchMock, 1);
  });

  test("should include timeout signal in fetch request", async () => {
    const url = "https://example.com/webhook";
    const result = await sendTest({ url });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });

  test("should honor custom timeoutMs", async () => {
    const url = "https://example.com/webhook";
    let capturedSignal: AbortSignal | undefined;
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", (_url, init) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        if (capturedSignal?.aborted) {
          reject(capturedSignal.reason);
          return;
        }
        capturedSignal?.addEventListener("abort", () => {
          reject(new DOMException("The signal has been aborted", "AbortError"));
        });
      });
    });

    const start = Date.now();
    await expect(sendTest({ url, timeoutMs: 20 })).rejects.toThrow(
      "Failed to send test",
    );
    const duration = Date.now() - start;
    expect(capturedSignal?.aborted).toBe(true);
    expect(duration).toBeLessThan(1000);
  });

  test("should throw error when request times out", async () => {
    const url = "https://example.com/webhook";
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () => {
      const error = new DOMException(
        "The signal has been aborted",
        "AbortError",
      );
      return Promise.reject(error);
    });

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    assertSpyCalls(fetchMock, 1);
  });
});

describe("Webhook notifications with deadline", () => {
  let fetchMock: Stub<typeof globalThis>;

  test("exports DEFAULT_TIMEOUT_MS as 10000ms", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });

  const mockContext = {
    monitor: {
      id: 1,
      name: "test-monitor",
      url: "https://example.com",
    },
    notification: {
      data: JSON.stringify({
        webhook: {
          endpoint: "https://example.com/webhook",
          headers: [{ key: "X-Test", value: "1" }],
        },
      }),
    },
    cronTimestamp: 1700000000000,
    statusCode: 500,
    latency: 250,
    message: "Server Error",
  } as unknown as NotificationContext;

  beforeEach(() => {
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test("sendAlert passes deadline signal and custom headers", async () => {
    await sendAlert(mockContext);

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe("https://example.com/webhook");
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    expect(callArgs[1].headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Test": "1",
    });
  });

  test("sendAlert fails when deadline expires", async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", (_url, init) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        if (capturedSignal?.aborted) {
          reject(capturedSignal.reason);
          return;
        }
        capturedSignal?.addEventListener("abort", () => {
          reject(new DOMException("The signal has been aborted", "AbortError"));
        });
      });
    });

    const start = Date.now();
    await expect(sendAlert(mockContext, { timeoutMs: 20 })).rejects.toThrow();
    const duration = Date.now() - start;
    expect(capturedSignal?.aborted).toBe(true);
    expect(duration).toBeLessThan(1000);
  });

  test("sendAlert honors context timeoutMs from outbox", async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", (_url, init) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        if (capturedSignal?.aborted) {
          reject(capturedSignal.reason);
          return;
        }
        capturedSignal?.addEventListener("abort", () => {
          reject(new DOMException("The signal has been aborted", "AbortError"));
        });
      });
    });

    await expect(
      sendAlert({ ...mockContext, timeoutMs: 20 }),
    ).rejects.toThrow();
    expect(capturedSignal?.aborted).toBe(true);
  });

  test("sendAlert aborts when context signal is aborted", async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | undefined;
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", (_url, init) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        if (capturedSignal?.aborted) {
          reject(new DOMException("The signal has been aborted", "AbortError"));
          return;
        }
        capturedSignal?.addEventListener("abort", () => {
          reject(new DOMException("The signal has been aborted", "AbortError"));
        });
      });
    });

    const promise = sendAlert({ ...mockContext, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow();
    expect(capturedSignal?.aborted).toBe(true);
  });

  test("sendRecovery passes deadline signal", async () => {
    await sendRecovery(mockContext, { timeoutMs: 3000 });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });

  test("sendDegraded passes deadline signal", async () => {
    await sendDegraded(mockContext);

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });
});
