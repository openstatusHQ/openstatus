import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import type { Incident, Monitor } from "@openstatus/db/src/schema";
import { selectNotificationSchema } from "@openstatus/db/src/schema";

import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

type FetchMock = ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

type AdaptiveCardElement = {
  type: string;
  text?: string;
  color?: string;
  style?: string;
  items?: AdaptiveCardElement[];
  facts?: Array<{ title: string; value: string }>;
};

type AdaptiveCardAction = {
  type: string;
  title: string;
  url: string;
};

type AdaptiveCardPayload = {
  type: string;
  version: string;
  body: AdaptiveCardElement[];
  actions: AdaptiveCardAction[];
};

type MessagePayload = {
  type: string;
  attachments: Array<{
    contentType: string;
    content: AdaptiveCardPayload;
  }>;
};

describe("Microsoft Teams Notifications", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    // @ts-expect-error spyOn typing requires the full `typeof fetch` (incl. preconnect)
    fetchMock = spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const createMockMonitor = (): Monitor => ({
    id: 1,
    name: "API Health Check",
    url: "https://api.example.com/health",
    jobType: "http",
    periodicity: "5m",
    status: "active",
    active: true,
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    regions: ["iad"],
    description: "",
    headers: [],
    body: "",
    workspaceId: 1,
    timeout: 45000,
    degradedAfter: null,
    assertions: null,
    method: "GET",
    deletedAt: null,
    externalName: null,
    otelEndpoint: null,
    otelHeaders: [],
    retry: 3,
    followRedirects: false,
  });

  const createMockNotification = () => ({
    id: 1,
    name: "Microsoft Teams Notification",
    provider: "ms-teams" as const,
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: JSON.stringify({
      "ms-teams": {
        webhookUrl:
          "https://prod-00.westeurope.logic.azure.com:443/workflows/test/triggers/manual/paths/invoke",
      },
    }),
  });

  const createMockResolvedIncident = (): Incident => ({
    id: 1,
    title: "",
    summary: "",
    status: "resolved",
    monitorId: 1,
    workspaceId: 1,
    startedAt: new Date("2026-01-22T10:00:00.000Z"),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: new Date("2026-01-22T12:15:30.000Z"),
    resolvedBy: null,
    incidentScreenshotUrl: null,
    recoveryScreenshotUrl: null,
    autoResolved: true,
    createdAt: new Date("2026-01-22T10:00:00.000Z"),
    updatedAt: new Date("2026-01-22T12:15:30.000Z"),
  });

  const readMessagePayload = (): MessagePayload => {
    const calls = fetchMock.mock.calls;
    const init = calls[0][1];
    if (!init || typeof init.body !== "string") {
      throw new Error("expected string body");
    }
    return JSON.parse(init.body) as MessagePayload;
  };

  const getCard = (msg: MessagePayload): AdaptiveCardPayload => {
    return msg.attachments[0].content;
  };

  const findContainerByStyle = (
    card: AdaptiveCardPayload,
    style: string,
  ): AdaptiveCardElement | undefined => {
    return card.body.find(
      (el) => el.type === "Container" && el.style === style,
    );
  };

  const findFactSet = (
    card: AdaptiveCardPayload,
  ): AdaptiveCardElement | undefined => {
    return card.body.find((el) => el.type === "FactSet");
  };

  const findTextBlockContaining = (
    card: AdaptiveCardPayload,
    needle: string,
  ): AdaptiveCardElement | undefined => {
    return card.body.find(
      (el) =>
        el.type === "TextBlock" &&
        typeof el.text === "string" &&
        el.text.includes(needle),
    );
  };

  test("Send Alert", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendAlert({
      monitor,
      notification,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
      latency: 1500,
      regions: ["iad"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("logic.azure.com");
    expect(init?.method).toBe("POST");

    const msg = readMessagePayload();
    expect(msg.type).toBe("message");
    expect(msg.attachments[0].contentType).toBe(
      "application/vnd.microsoft.card.adaptive",
    );

    const card = getCard(msg);
    expect(card.type).toBe("AdaptiveCard");
    expect(card.version).toBe("1.5");

    const header = findContainerByStyle(card, "attention");
    expect(header).toBeDefined();
    const title = header?.items?.[0];
    expect(title?.text).toContain("API Health Check");
    expect(title?.text).toContain("is failing");
    expect(title?.color).toBe("Attention");

    const factSet = findFactSet(card);
    expect(factSet?.facts).toHaveLength(4);
    expect(factSet?.facts?.[0]).toEqual({
      title: "Status code",
      value: "500 Internal Server Error",
    });

    const action = card.actions[0];
    expect(action.type).toBe("Action.OpenUrl");
    expect(action.title).toBe("View dashboard");
    expect(action.url).toBe("https://app.openstatus.dev/monitors/1");
  });

  test("Send Recovery (no incident)", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendRecovery({
      monitor,
      notification,
      statusCode: 200,
      cronTimestamp: Date.now(),
      latency: 150,
      regions: ["iad"],
    });

    const card = getCard(readMessagePayload());
    const header = findContainerByStyle(card, "good");
    expect(header).toBeDefined();
    expect(header?.items?.[0]?.text).toContain("is recovered");
    expect(findTextBlockContaining(card, "Downtime:")).toBeUndefined();
  });

  test("Send Recovery (with resolved incident)", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendRecovery({
      monitor,
      notification,
      statusCode: 200,
      cronTimestamp: Date.now(),
      latency: 150,
      regions: ["iad"],
      incident: createMockResolvedIncident(),
    });

    const card = getCard(readMessagePayload());
    const downtime = findTextBlockContaining(card, "Downtime:");
    expect(downtime).toBeDefined();
    expect(downtime?.text).toContain("2h 15m 30s");
  });

  test("Send Degraded (no incident)", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendDegraded({
      monitor,
      notification,
      statusCode: 504,
      message: "slow",
      cronTimestamp: Date.now(),
      latency: 5234,
      regions: ["iad"],
    });

    const card = getCard(readMessagePayload());
    const header = findContainerByStyle(card, "warning");
    expect(header).toBeDefined();
    expect(header?.items?.[0]?.text).toContain("is degraded");
    expect(
      findTextBlockContaining(card, "Previous incident duration:"),
    ).toBeUndefined();
  });

  test("Send Degraded (with incident)", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendDegraded({
      monitor,
      notification,
      statusCode: 504,
      message: "slow",
      cronTimestamp: Date.now(),
      latency: 5234,
      regions: ["iad"],
      incident: createMockResolvedIncident(),
    });

    const card = getCard(readMessagePayload());
    const block = findTextBlockContaining(card, "Previous incident duration:");
    expect(block).toBeDefined();
    expect(block?.text).toContain("2h 15m 30s");
  });

  test("Send Test", async () => {
    await sendTest({
      webhookUrl:
        "https://prod-00.westeurope.logic.azure.com:443/workflows/test/triggers/manual/paths/invoke",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const card = getCard(readMessagePayload());
    const header = findContainerByStyle(card, "good");
    expect(header?.items?.[0]?.text).toBe("Test notification");
    expect(card.actions[0].url).toBe("https://app.openstatus.dev");
  });

  test("Send Test with empty webhookUrl", async () => {
    await expect(sendTest({ webhookUrl: "" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Handle fetch error", async () => {
    // @ts-expect-error see beforeEach
    fetchMock.mockImplementation(() =>
      Promise.reject(new Error("Network error")),
    );

    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await expect(
      sendAlert({
        monitor,
        notification,
        statusCode: 500,
        message: "boom",
        cronTimestamp: Date.now(),
        latency: 1000,
        regions: ["iad"],
      }),
    ).rejects.toThrow();
  });
});
