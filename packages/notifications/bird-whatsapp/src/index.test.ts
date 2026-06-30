import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  spyOn,
  test,
} from "bun:test";

import type { Monitor } from "@openstatus/db/src/schema";
import { selectNotificationSchema } from "@openstatus/db/src/schema";

import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

const BIRD_URL_PATTERN =
  /https:\/\/api\.bird\.com\/workspaces\/.*\/channels\/.*\/batch\/messages/;

function createMonitor(): Monitor {
  return {
    url: "https://api.example.com/health",
  } as Monitor;
}

function createNotification() {
  return selectNotificationSchema.parse({
    id: 1,
    name: "WhatsApp Notification",
    provider: "whatsapp",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: '{"whatsapp":"+33623456789"}',
  });
}

function parseRequestBody(call: ReturnType<typeof spyOn>): {
  messageRequests: Array<{
    receiver: {
      contacts: Array<{ identifierKey: string; identifierValue: string }>;
    };
    template: {
      projectId: string;
      version: string;
      locale: string;
      parameters: Array<{ type: string; key: string; value: string }>;
    };
  }>;
} {
  const body = (call as ReturnType<typeof spyOn>).mock.calls[0][1]?.body;
  return JSON.parse(body as string);
}

describe("WhatsApp Notifications (Bird)", () => {
  let fetchMock: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // @ts-expect-error
    fetchMock = spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("sendAlert calls Bird API with alert template", async () => {
    await sendAlert({
      monitor: createMonitor(),
      notification: createNotification(),
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(BIRD_URL_PATTERN);

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).toHaveProperty("Authorization");
    expect((options.headers as Record<string, string>).Authorization).toMatch(
      /^AccessKey /,
    );

    const body = parseRequestBody(fetchMock);
    expect(body.messageRequests[0].receiver.contacts[0].identifierKey).toBe(
      "phonenumber",
    );
    expect(body.messageRequests[0].receiver.contacts[0].identifierValue).toBe(
      "+33623456789",
    );
    expect(body.messageRequests[0].template.projectId).toBe(
      "20cd47e2-70e9-4e06-97be-21eee5e4de33",
    );
    expect(body.messageRequests[0].template.version).toBe(
      "9a86655b-9e5a-4e8a-80f3-33f232bb7e63",
    );
    expect(body.messageRequests[0].template.locale).toBe("en");
    expect(body.messageRequests[0].template.parameters[0].key).toBe(
      "monitor_url",
    );
    expect(body.messageRequests[0].template.parameters[0].value).toBe(
      "https://api.example.com/health",
    );
  });

  test("sendRecovery calls Bird API with recovery template", async () => {
    await sendRecovery({
      monitor: createMonitor(),
      notification: createNotification(),
      statusCode: 200,
      message: "Back up",
      cronTimestamp: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = parseRequestBody(fetchMock);
    expect(body.messageRequests[0].template.projectId).toBe(
      "2068001e-330d-4093-8d06-7071e9d34aa1",
    );
    expect(body.messageRequests[0].template.version).toBe(
      "af66e5de-015b-4822-a34e-fb6dfd538bb6",
    );
    expect(body.messageRequests[0].template.parameters[0].value).toBe(
      "https://api.example.com/health",
    );
  });

  test("sendDegraded calls Bird API with degraded template", async () => {
    await sendDegraded({
      monitor: createMonitor(),
      notification: createNotification(),
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = parseRequestBody(fetchMock);
    expect(body.messageRequests[0].template.projectId).toBe(
      "c9a842d9-cf9e-4a13-8cde-024d57e29143",
    );
    expect(body.messageRequests[0].template.version).toBe(
      "dcbfac35-db0e-4e07-9390-e53dda2fda0b",
    );
    expect(body.messageRequests[0].template.parameters[0].value).toBe(
      "https://api.example.com/health",
    );
  });

  test("sendTest calls Bird API with test template and openstat.us URL", async () => {
    await sendTest({ phoneNumber: "+33623456789" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = parseRequestBody(fetchMock);
    expect(body.messageRequests[0].receiver.contacts[0].identifierValue).toBe(
      "+33623456789",
    );
    expect(body.messageRequests[0].template.projectId).toBe(
      "3315bcd8-2fde-411c-83c5-009ac4b4b8ff",
    );
    expect(body.messageRequests[0].template.version).toBe(
      "a3e55807-ff35-4dbc-a16b-670c7eeaae85",
    );
    expect(body.messageRequests[0].template.parameters[0].value).toBe(
      "https://openstat.us",
    );
  });
});
