import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { sendTest } from "./index";

describe("Webhook sendTest", () => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let fetchMock: any = undefined;

  beforeEach(() => {
    fetchMock = spyOn(global, "fetch");
  });

  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockClear();
      fetchMock.mockRestore();
    }
  });

  test("should send test webhook successfully", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await sendTest({ url });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "post",
        body: expect.any(String),
        headers: { "Content-Type": "application/json" },
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
    expect(body.cronTimestamp).toBeTypeOf("number");
  });

  test("should send test webhook with headers", async () => {
    const url = "https://example.com/webhook";
    const headers = [
      { key: "Authorization", value: "Bearer token123" },
      { key: "Content-Type", value: "application/json" },
    ];
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await sendTest({ url, headers });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      url,
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
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should throw error when fetch fails", async () => {
    const url = "https://example.com/webhook";
    const networkError = new Error("Network error");
    fetchMock.mockRejectedValue(networkError);

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should send test webhook with empty headers array", async () => {
    const url = "https://example.com/webhook";
    const headers: { key: string; value: string }[] = [];
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await sendTest({ url, headers });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    // Empty headers array should result in empty object after transformHeaders
    expect(callArgs[1].headers).toEqual({});
  });

  test("should send test webhook with 500 status code", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(sendTest({ url })).rejects.toThrow("Failed to send test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("should send test webhook with 201 status code (success)", async () => {
    const url = "https://example.com/webhook";
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));

    const result = await sendTest({ url });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
