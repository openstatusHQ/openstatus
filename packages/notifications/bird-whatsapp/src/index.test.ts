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
      "446fc1ad-3ff4-40fb-8b11-ebfd02513c5d",
    );
    expect(body.messageRequests[0].template.version).toBe(
      "679aa339-4037-4aa6-8063-ab290249fd14",
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
      "61d6052d-2abf-422a-ab61-a918ab638a83",
    );
    expect(body.messageRequests[0].template.version).toBe(
      "dc8cd91a-f44a-4df8-af0c-f62fcd90df61",
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
      "6ef3a922-1960-444a-b385-2716f157e10b",
    );
    expect(body.messageRequests[0].template.version).toBe(
      "1f1a133c-ab83-477b-b104-3d4a9db6ec7b",
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
      "43f04cfa-b400-4e70-9389-76fee497f250",
    );
    expect(body.messageRequests[0].template.version).toBe(
      "9478e278-d319-4f26-8682-c689970e1803",
    );
    expect(body.messageRequests[0].template.parameters[0].value).toBe(
      "https://openstat.us",
    );
  });
});
