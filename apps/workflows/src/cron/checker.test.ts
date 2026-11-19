import type { CloudTasksClient } from "@google-cloud/tasks";
import { selectMonitorSchema } from "@openstatus/db/src/schema";
import { regionDict } from "@openstatus/regions";
import { describe, expect, test, vi } from "vitest";

import { env } from "../env";
import { createCloudTasks, isAuthorizedDomain } from "./checker";
import type { TaskInput } from "./checker-payload";

type CreateTaskRequest = Parameters<CloudTasksClient["createTask"]>[0];

// the module opens an embedded replica file on import; these tests never query
vi.mock("../lib/db", () => ({ db: {} }));

const row = selectMonitorSchema.parse({
  id: 42,
  jobType: "http",
  periodicity: "1m",
  status: "active",
  active: true,
  regions: "ams",
  url: "https://example.com",
  name: "example",
  externalName: null,
  description: "",
  headers: '[{"key":"x-api-key","value":"secret"}]',
  body: "",
  method: "GET",
  workspaceId: 7,
  timeout: 45000,
  degradedAfter: null,
  assertions: null,
  otelEndpoint: null,
  otelHeaders: null,
  public: false,
  retry: 3,
  followRedirects: true,
  grpcService: null,
  grpcTls: "tls",
  heartbeatToken: null,
  heartbeatPeriod: null,
  heartbeatGrace: null,
  heartbeatCron: null,
  heartbeatTz: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  deletedAt: null,
});

const timestamp = 1_700_000_000_000;
const input = (region: TaskInput["region"]): TaskInput => ({
  row,
  timestamp,
  status: "active",
  region,
});

// safe because createCloudTasks only calls queuePath and createTask
function fakeClient(createTask: (request: CreateTaskRequest) => unknown) {
  const requests: CreateTaskRequest[] = [];
  const client = {
    queuePath: (project: string, location: string, queue: string) =>
      `projects/${project}/locations/${location}/queues/${queue}`,
    createTask: async (request: CreateTaskRequest) => {
      requests.push(request);
      return createTask(request);
    },
  } as unknown as CloudTasksClient;
  return { client, requests };
}

const regionOf = (provider: string) => {
  const found = Object.entries(regionDict).find(
    ([, info]) => info.provider === provider && !info.deprecated,
  );
  return found?.[0] as TaskInput["region"] | undefined;
};

describe("createCloudTasks", () => {
  test("creates one task per input on the periodicity queue", async () => {
    const { client, requests } = fakeClient(() => [{}]);

    const result = await createCloudTasks([input("ams")], "1m", client);

    expect(result).toEqual({ success: 1, failed: 0 });
    const task = requests[0]?.task;
    expect(requests[0]?.parent).toMatch(/\/queues\/1m$/);
    expect(task?.name).toBe(
      `${requests[0]?.parent}/tasks/monitor-42-ams-${timestamp}`,
    );
    expect(task?.scheduleTime).toEqual({ seconds: timestamp / 1000 });
    expect(task?.httpRequest?.url).toBe(
      "https://openstatus-checker.fly.dev/checker/http?monitor_id=42",
    );
    expect(task?.httpRequest?.headers).toMatchObject({
      Authorization: `Basic ${env().CRON_SECRET}`,
      "fly-prefer-region": "ams",
    });
    const body = JSON.parse(
      Buffer.from(String(task?.httpRequest?.body), "base64").toString(),
    );
    expect(body).toMatchObject({ monitorId: "42", cronTimestamp: timestamp });
  });

  test("a task that already exists counts as created", async () => {
    const { client } = fakeClient(() => {
      throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 });
    });

    const result = await createCloudTasks(
      [input("ams"), input("iad")],
      "1m",
      client,
    );

    expect(result).toEqual({ success: 2, failed: 0 });
  });

  test.each(["koyeb", "railway"])(
    "a %s region is routed to that provider",
    async (provider) => {
      const region = regionOf(provider);
      if (!region) return;
      const { client, requests } = fakeClient(() => [{}]);

      await createCloudTasks([input(region)], "1m", client);

      const request = requests[0]?.task?.httpRequest;
      expect(request?.url).toContain(provider);
      expect(request?.headers).not.toHaveProperty("fly-prefer-region");
    },
  );
});

describe("isAuthorizedDomain", () => {
  test("accepts urls on the site domain only", () => {
    expect(isAuthorizedDomain(`${env().SITE_URL}/api/checker`)).toBe(true);
    expect(isAuthorizedDomain("https://example.com/api/checker")).toBe(false);
  });
});
