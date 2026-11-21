import type { NotificationContext } from "@openstatus/notification-base";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import {
  DEFAULT_WEBHOOK_TIMEOUT_MS,
  createDeliverySignal,
  sendAlert,
  sendDegraded,
  sendRecovery,
  sendTest,
} from "./index";

describe("Webhook sendTest", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  test("should send test webhook successfully", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      );

    const result = await sendTest({ url });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "post",
        body: expect.any(String),
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );

    const callArgs = fetchMock.mock.calls[0];
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
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      );

    const result = await sendTest({ url, headers });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1]).toEqual(
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
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 400 })),
      );

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should throw error when fetch fails", async () => {
    const url = "https://example.com/webhook";
    const networkError = new Error("Network error");
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.reject(networkError));

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should send test webhook with empty headers array", async () => {
    const url = "https://example.com/webhook";
    const headers: { key: string; value: string }[] = [];
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      );

    const result = await sendTest({ url, headers });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers).toEqual({ "Content-Type": "application/json" });
  });

  test("should send test webhook with 500 status code", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 500 })),
      );

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should send test webhook with 201 status code (success)", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 201 })),
      );

    const result = await sendTest({ url });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should cancel unused response body after delivery", async () => {
    const url = "https://example.com/webhook";
    let bodyCancelled = false;
    const mockBody = {
      cancel: vi.fn(() => {
        bodyCancelled = true;
        return Promise.resolve();
      }),
    };

    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        body: mockBody,
      } as unknown as Response),
    );

    const result = await sendTest({ url });
    expect(result).toBe(true);
    expect(mockBody.cancel).toHaveBeenCalled();
    expect(bodyCancelled).toBe(true);
  });

  test("should abort and fail when server delays response headers beyond the timeout", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(new Response(null, { status: 200 }));
        }, 150);
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(init.signal!.reason);
          });
        }
      });
    });

    await expect(
      sendTest({ url, timeoutMs: 25 }),
    ).rejects.toThrow("Failed to send test");
  });

  test("should abort and fail when deadline expires during validation", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    const preAbortedSignal = AbortSignal.abort(
      new Error("Pre-validation deadline exceeded"),
    );

    await expect(
      sendTest({ url, signal: preAbortedSignal }),
    ).rejects.toThrow("Failed to send test");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("should share one timeout budget across redirect hops and fail when total duration exceeds budget", async () => {
    const hops: Record<string, [number, string]> = {
      "https://example.com/hook": [307, "https://example.com/hop2"],
      "https://example.com/hop2": [307, "https://example.com/hop3"],
      "https://example.com/hop3": [200, ""],
    };

    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const targetUrl = String(input);
      const hop = hops[targetUrl];
      return new Promise((resolve, reject) => {
        // Each hop delays response headers by 35ms
        const timer = setTimeout(() => {
          if (hop && hop[0] >= 300 && hop[0] < 400) {
            resolve(
              new Response(null, {
                status: hop[0],
                headers: { location: hop[1] },
              }),
            );
          } else {
            resolve(new Response(null, { status: 200 }));
          }
        }, 35);

        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(init.signal!.reason);
          });
        }
      });
    });

    // Total budget is 50ms. Hop 1 takes 35ms, Hop 2 needs another 35ms (70ms total > 50ms).
    await expect(
      sendTest({ url: "https://example.com/hook", timeoutMs: 50 }),
    ).rejects.toThrow("Failed to send test");
  });

  test("should follow redirect chain within shared budget", async () => {
    const hops: Record<string, [number, string]> = {
      "https://example.com/hook": [307, "https://example.com/hop2"],
      "https://example.com/hop2": [200, ""],
    };

    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const targetUrl = String(input);
      const hop = hops[targetUrl];
      if (hop && hop[0] >= 300 && hop[0] < 400) {
        return Promise.resolve(
          new Response(null, {
            status: hop[0],
            headers: { location: hop[1] },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    const result = await sendTest({
      url: "https://example.com/hook",
      timeoutMs: 1000,
    });
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Webhook alert deliveries", () => {
  let fetchMock: MockInstance;

  const mockContext: NotificationContext = {
    monitor: {
      id: 1,
      name: "API Monitor",
      url: "https://api.example.com",
      periodicity: "10m",
      jobType: "http",
      active: true,
      public: true,
      createdAt: null,
      updatedAt: null,
      regions: ["ams"],
      description: "Monitor Description",
      headers: [],
      body: "",
      workspaceId: 1,
      timeout: 10000,
      degradedAfter: null,
      assertions: null,
      status: "active",
      method: "GET",
      deletedAt: null,
      externalName: null,
      otelEndpoint: null,
      otelHeaders: [],
      retry: 0,
      followRedirects: false,
      grpcService: null,
      grpcTls: null,
      heartbeatToken: null,
      heartbeatPeriod: null,
      heartbeatGrace: null,
      heartbeatCron: null,
      heartbeatTz: null,
    },
    notification: {
      id: 10,
      name: "Slack Webhook",
      workspaceId: 1,
      provider: "webhook",
      data: JSON.stringify({
        webhook: {
          endpoint: "https://example.com/alerts",
          headers: [{ key: "X-Test", value: "true" }],
        },
      }),
      createdAt: null,
      updatedAt: null,
    },
    cronTimestamp: Date.now(),
    statusCode: 500,
    latency: 250,
    message: "Service Unavailable",
  };

  beforeEach(() => {
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  test("sendAlert delivers successfully with shared deadline signal", async () => {
    await sendAlert(mockContext);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/alerts");
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "post",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test("sendAlert fails when response headers delay past timeout", async () => {
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(new Response(null, { status: 200 }));
        }, 150);
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(init.signal!.reason);
          });
        }
      });
    });

    await expect(
      sendAlert(mockContext, { timeoutMs: 25 }),
    ).rejects.toThrow();
  });

  test("sendRecovery delivers successfully and cancels body", async () => {
    let bodyCancelled = false;
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        body: {
          cancel: () => {
            bodyCancelled = true;
            return Promise.resolve();
          },
        },
      } as unknown as Response),
    );

    await sendRecovery(mockContext);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyCancelled).toBe(true);
  });

  test("sendDegraded delivers successfully and cancels body", async () => {
    let bodyCancelled = false;
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        body: {
          cancel: () => {
            bodyCancelled = true;
            return Promise.resolve();
          },
        },
      } as unknown as Response),
    );

    await sendDegraded(mockContext);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyCancelled).toBe(true);
  });

  test("sendAlert throws when response status is non-2xx", async () => {
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 503, statusText: "Service Unavailable" })),
    );

    await expect(sendAlert(mockContext)).rejects.toThrow(
      "Failed to send webhook notification: Service Unavailable",
    );
  });
});
