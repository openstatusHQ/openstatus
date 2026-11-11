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
  sendAlert,
  sendDegraded,
  sendRecovery,
  sendTest,
  WEBHOOK_TIMEOUT_MS,
} from "./index";

const mockContext: NotificationContext = {
  monitor: {
    id: 1,
    name: "OpenStatus Monitor",
    url: "https://www.openstatus.dev",
    periodicity: "10m",
    jobType: "http",
    active: true,
    public: true,
    createdAt: null,
    updatedAt: null,
    regions: ["ams", "fra"],
    description: "Monitor Description",
    headers: [],
    body: "",
    workspaceId: 1,
    timeout: 45000,
    degradedAfter: null,
    assertions: null,
    status: "active",
    method: "GET",
    deletedAt: null,
    externalName: null,
    otelEndpoint: null,
    otelHeaders: [],
    retry: 3,
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
    id: 1,
    name: "Webhook",
    data: JSON.stringify({
      webhook: {
        endpoint: "https://example.com/webhook",
        headers: [{ key: "X-Custom-Header", value: "test-value" }],
      },
    }),
    createdAt: null,
    updatedAt: null,
    workspaceId: 1,
    provider: "webhook",
  },
  cronTimestamp: 1700000000000,
  statusCode: 500,
  latency: 350,
  message: "Connection failed",
};

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

  test("should compose caller signal with default timeout", async () => {
    const url = "https://example.com/webhook";
    const controller = new AbortController();
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      );

    const result = await sendTest({ url, signal: controller.signal });

    expect(result).toBe(true);
    const init = fetchMock.mock.calls[0][1];
    expect(init.signal).not.toBe(controller.signal);
    expect(init.signal.aborted).toBe(false);
    controller.abort(new DOMException("caller aborted", "AbortError"));
    expect(init.signal.aborted).toBe(true);
  });

  test("should fail when timeoutMs is 0", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            return reject(signal.reason);
          }
          signal?.addEventListener("abort", () => {
            reject(signal.reason);
          });
        });
      });

    await expect(sendTest({ url, timeoutMs: 0 })).rejects.toThrow(
      "Failed to send test",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should not hang up when response body cancel never settles", async () => {
    const url = "https://example.com/webhook";
    const hangingBody = {
      cancel: vi.fn().mockImplementation(() => new Promise(() => {})),
    };
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        body: hangingBody,
      } as unknown as Response),
    );

    await expect(sendTest({ url, timeoutMs: 30 })).rejects.toThrow(
      "Failed to send test",
    );
    expect(hangingBody.cancel).toHaveBeenCalledTimes(1);
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

  test("should fail when response headers are delayed past deadline", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            return reject(signal.reason);
          }
          signal?.addEventListener("abort", () => {
            reject(signal.reason);
          });
        });
      });

    await expect(sendTest({ url, timeoutMs: 30 })).rejects.toThrow(
      "Failed to send test",
    );
  });

  test("should fail when deadline expires during validation", async () => {
    const controller = new AbortController();
    controller.abort(
      new DOMException("deadline expired during validation", "TimeoutError"),
    );

    let fetchCalled = false;
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      fetchCalled = true;
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    await expect(
      sendTest({
        url: "https://example.com/webhook",
        signal: controller.signal,
      }),
    ).rejects.toThrow("Failed to send test");
    expect(fetchCalled).toBe(false);
  });

  test("should fail when redirect chain exceeds the shared deadline budget", async () => {
    const controller = new AbortController();
    let hopCount = 0;

    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        hopCount++;
        const targetUrl = String(input);
        if (targetUrl === "https://example.com/webhook") {
          return Promise.resolve(
            new Response(null, {
              status: 307,
              headers: { location: "/webhook-redirect" },
            }),
          );
        }
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            return reject(signal.reason);
          }
          signal?.addEventListener("abort", () => {
            reject(signal.reason);
          });
          controller.abort(
            new DOMException("shared deadline expired", "TimeoutError"),
          );
        });
      });

    await expect(
      sendTest({
        url: "https://example.com/webhook",
        signal: controller.signal,
      }),
    ).rejects.toThrow("Failed to send test");
    expect(hopCount).toBe(2);
  });

  test("should succeed when redirect chain completes within deadline", async () => {
    let hopCount = 0;
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      hopCount++;
      const targetUrl = String(input);
      if (targetUrl === "https://example.com/webhook") {
        return Promise.resolve(
          new Response(null, {
            status: 307,
            headers: { location: "/webhook-redirect" },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    const result = await sendTest({
      url: "https://example.com/webhook",
      timeoutMs: 1000,
    });

    expect(result).toBe(true);
    expect(hopCount).toBe(2);
  });

  test("should cancel unused response bodies on redirect and final response", async () => {
    const intermediateBody = { cancel: vi.fn().mockResolvedValue(undefined) };
    const finalBody = { cancel: vi.fn().mockResolvedValue(undefined) };

    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const targetUrl = String(input);
      if (targetUrl === "https://example.com/webhook") {
        return Promise.resolve({
          ok: false,
          status: 307,
          statusText: "Temporary Redirect",
          headers: new Headers({ location: "/webhook-redirect" }),
          body: intermediateBody,
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        body: finalBody,
      } as unknown as Response);
    });

    const result = await sendTest({
      url: "https://example.com/webhook",
      timeoutMs: 1000,
    });

    expect(result).toBe(true);
    expect(intermediateBody.cancel).toHaveBeenCalledTimes(1);
    expect(finalBody.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("Webhook sendAlert, sendRecovery, sendDegraded", () => {
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

  test("sendAlert sends webhook successfully with deadline signal", async () => {
    await sendAlert(mockContext);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/webhook");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("post");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body.status).toBe("error");
    expect(body.errorMessage).toBe("Connection failed");
    expect(init.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "X-Custom-Header": "test-value",
      }),
    );
  });

  test("sendRecovery sends webhook successfully with status recovered", async () => {
    await sendRecovery(mockContext);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/webhook");
    const init = fetchMock.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body.status).toBe("recovered");
  });

  test("sendDegraded sends webhook successfully with status degraded", async () => {
    await sendDegraded(mockContext);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/webhook");
    const init = fetchMock.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body.status).toBe("degraded");
  });

  test("sendAlert fails when response headers are delayed past deadline", async () => {
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            return reject(signal.reason);
          }
          signal?.addEventListener("abort", () => {
            reject(signal.reason);
          });
        });
      });

    await expect(sendAlert(mockContext, { timeoutMs: 30 })).rejects.toThrow();
  });

  test("sendAlert fails immediately when deadline expires during validation", async () => {
    const controller = new AbortController();
    controller.abort(
      new DOMException("deadline expired during validation", "TimeoutError"),
    );

    let fetchCalled = false;
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      fetchCalled = true;
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    await expect(
      sendAlert(mockContext, { signal: controller.signal }),
    ).rejects.toThrow("deadline expired during validation");
    expect(fetchCalled).toBe(false);
  });

  test("sendAlert throws when non-2xx status code is returned", async () => {
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      return Promise.resolve(
        new Response(null, { status: 503, statusText: "Service Unavailable" }),
      );
    });

    await expect(sendAlert(mockContext)).rejects.toThrow(
      "Failed to send webhook notification: Service Unavailable",
    );
  });

  test("sendAlert cancels response body even when non-2xx error is thrown", async () => {
    const finalBody = { cancel: vi.fn().mockResolvedValue(undefined) };
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        body: finalBody,
      } as unknown as Response);
    });

    await expect(sendAlert(mockContext)).rejects.toThrow(
      "Failed to send webhook notification: Internal Server Error",
    );
    expect(finalBody.cancel).toHaveBeenCalledTimes(1);
  });

  test("sendAlert does not hang up when response body cancel never settles", async () => {
    const hangingBody = {
      cancel: vi.fn().mockImplementation(() => new Promise(() => {})),
    };
    fetchMock.mockRestore();
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        body: hangingBody,
      } as unknown as Response);
    });

    await expect(sendAlert(mockContext, { timeoutMs: 30 })).rejects.toThrow();
    expect(hangingBody.cancel).toHaveBeenCalledTimes(1);
  });

  test("WEBHOOK_TIMEOUT_MS constant is 5000ms", () => {
    expect(WEBHOOK_TIMEOUT_MS).toBe(5000);
  });
});
