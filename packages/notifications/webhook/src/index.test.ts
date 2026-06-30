import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, stub, type Stub } from "@std/testing/mock";

import { sendTest } from "./index";

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

  test("should send test webhook with 201 status code (success)", async () => {
    const url = "https://example.com/webhook";
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 201 })),
    );

    const result = await sendTest({ url });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
  });
});
