import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import type { Monitor, Notification } from "@openstatus/db/src/schema";

import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

const token = "azGDORePK8gMaC0QOYAMyEEuzJnyUi";
const user = "uQiRzpo4DXghDmr9QzzfQu27cmVRsG";
const cronTimestamp = 1700000000000;

const makeMonitor = (url: string): Monitor => ({
  id: 1,
  name: "API",
  url,
  periodicity: "10m",
  jobType: "http",
  active: true,
  public: true,
  createdAt: null,
  updatedAt: null,
  regions: ["ams"],
  description: "",
  headers: [],
  body: "",
  workspaceId: 1,
  timeout: 45000,
  degradedAfter: null,
  assertions: null,
  status: "active",
  method: "GET",
  deletedAt: null,
  otelEndpoint: null,
  otelHeaders: [],
  retry: 3,
  followRedirects: false,
  externalName: null,
});

const makeNotification = (priority: string | number): Notification => ({
  id: 1,
  name: "Pushover",
  provider: "pushover",
  workspaceId: 1,
  createdAt: null,
  updatedAt: null,
  data: JSON.stringify({ pushover: { token, user, priority } }),
});

const lastBody = (mock: ReturnType<typeof spyOn>) =>
  new URLSearchParams(mock.mock.calls[0][1]?.body as string);

describe("Pushover Notifications", () => {
  let fetchMock: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

  beforeEach(() => {
    fetchMock = spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  test("alert forwards the configured priority and deep-links the monitor url", async () => {
    await sendAlert({
      monitor: makeMonitor("https://api.example.com/health"),
      notification: makeNotification("1"),
      statusCode: 500,
      cronTimestamp,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.pushover.net/1/messages.json",
    );
    const body = lastBody(fetchMock);
    expect(body.get("token")).toBe(token);
    expect(body.get("user")).toBe(user);
    expect(body.get("priority")).toBe("1");
    expect(body.get("title")).toBe("API is down");
    expect(body.get("message")).toContain("status code 500");
    expect(body.get("url")).toBe("https://api.example.com/health");
    expect(body.get("url_title")).toBe("View monitor");
  });

  test("alert omits the url param for a non-http monitor url", async () => {
    await sendAlert({
      monitor: makeMonitor("db.example.com:5432"),
      notification: makeNotification("0"),
      message: "Connection timeout",
      cronTimestamp,
    });

    const body = lastBody(fetchMock);
    expect(body.has("url")).toBe(false);
    expect(body.has("url_title")).toBe(false);
    expect(body.get("message")).toContain("db.example.com:5432");
    expect(body.get("message")).toContain("error: Connection timeout");
  });

  test("recovery is always sent at normal priority", async () => {
    await sendRecovery({
      monitor: makeMonitor("https://api.example.com/health"),
      notification: makeNotification("1"),
      cronTimestamp,
    });

    const body = lastBody(fetchMock);
    expect(body.get("priority")).toBe("0");
    expect(body.get("title")).toBe("API is up");
    expect(body.get("message")).toContain("is up again");
  });

  test("degraded uses the configured priority", async () => {
    await sendDegraded({
      monitor: makeMonitor("https://api.example.com/health"),
      notification: makeNotification("-2"),
      cronTimestamp,
    });

    const body = lastBody(fetchMock);
    expect(body.get("priority")).toBe("-2");
    expect(body.get("message")).toContain("is degraded");
  });

  test("alert throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));

    await expect(
      sendAlert({
        monitor: makeMonitor("https://api.example.com/health"),
        notification: makeNotification("0"),
        statusCode: 500,
        cronTimestamp,
      }),
    ).rejects.toThrow("Failed to send pushover notification");
  });

  test("sendTest posts the expected params", async () => {
    const result = await sendTest({ token, user, priority: 1 });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init?.method).toBe("post");
    expect(init?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = lastBody(fetchMock);
    expect(body.get("token")).toBe(token);
    expect(body.get("user")).toBe(user);
    expect(body.get("priority")).toBe("1");
    expect(body.get("message")).toBe("This is a test message from OpenStatus");
  });

  test("sendTest defaults priority to 0 when omitted", async () => {
    await sendTest({ token, user });
    expect(lastBody(fetchMock).get("priority")).toBe("0");
  });

  test("sendTest throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));
    await expect(sendTest({ token, user })).rejects.toThrow(
      "Failed to send pushover notification",
    );
  });

  test("sendTest throws when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));
    await expect(sendTest({ token, user })).rejects.toThrow("Network error");
  });
});
