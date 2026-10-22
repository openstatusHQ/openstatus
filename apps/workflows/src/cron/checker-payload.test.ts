import { readFileSync } from "node:fs";

import { selectMonitorSchema } from "@openstatus/db/src/schema";
import { regionDict } from "@openstatus/regions";
import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
  type CheckerPublisher,
  type TaskInput,
  buildCheckerPayload,
  checkerTopic,
  publishCheckerTasks,
} from "./checker-payload";

const monitorRow = (
  overrides: Record<string, string | number | boolean | null>,
) =>
  selectMonitorSchema.parse({
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
    createdAt: new Date(0),
    updatedAt: new Date(0),
    deletedAt: null,
    ...overrides,
  });

const input = (
  overrides: Partial<TaskInput> & Pick<TaskInput, "row">,
): TaskInput => ({
  timestamp: 1_700_000_000_000,
  status: "active",
  region: "ams",
  ...overrides,
});

type Published = {
  topic: string;
  payload: ReturnType<typeof buildCheckerPayload>;
  attributes: Record<string, string>;
};

const recordingPublisher = (failTopics: string[] = []) => {
  const published: Published[] = [];
  const publisher: CheckerPublisher = {
    publish: async (topic, data, attributes) => {
      if (failTopics.includes(topic)) {
        throw new Error(`topic ${topic} not found`);
      }
      published.push({
        topic,
        payload: JSON.parse(data.toString()),
        attributes,
      });
      return String(published.length);
    },
  };
  return { published, publisher };
};

describe("buildCheckerPayload", () => {
  test("http keeps the request shape the checker binds", () => {
    const payload = buildCheckerPayload(
      input({
        row: monitorRow({
          assertions:
            '[{"version":"v1","type":"status","compare":"eq","target":200}]',
        }),
        status: "error",
      }),
    );

    expect(payload).toMatchObject({
      workspaceId: "7",
      monitorId: "42",
      url: "https://example.com",
      method: "GET",
      cronTimestamp: 1_700_000_000_000,
      headers: [{ key: "x-api-key", value: "secret" }],
      status: "error",
      assertions: [
        { version: "v1", type: "status", compare: "eq", target: 200 },
      ],
      trigger: "cron",
      retry: 3,
      followRedirects: true,
    });
  });

  test.each(["tcp", "dns", "icmp"] as const)(
    "%s sends the url as uri",
    (jobType) => {
      const payload = buildCheckerPayload(
        input({ row: monitorRow({ jobType, url: "example.com:443" }) }),
      );

      expect(payload).toMatchObject({
        monitorId: "42",
        uri: "example.com:443",
        trigger: "cron",
      });
      expect(payload).not.toHaveProperty("url");
    },
  );

  test("grpc sends headers as a map and defaults tls", () => {
    const payload = buildCheckerPayload(
      input({
        row: monitorRow({
          jobType: "grpc",
          url: "grpc.example.com:443",
          grpcService: "health",
          grpcTls: null,
        }),
      }),
    );

    expect(payload).toMatchObject({
      uri: "grpc.example.com:443",
      service: "health",
      tls: "tls",
      headers: { "x-api-key": "secret" },
    });
  });
});

describe("checkerTopic", () => {
  test("30s monitors get their own topic", () => {
    expect(checkerTopic("ams", "30s")).toBe("checker-ams-30s");
    expect(checkerTopic("koyeb_fra", "1m")).toBe("checker-koyeb_fra");
  });
});

describe("publishCheckerTasks", () => {
  test("publishes to the region topic with routing attributes", async () => {
    const { published, publisher } = recordingPublisher();
    const row = monitorRow({ jobType: "tcp" });

    const result = await publishCheckerTasks(
      [input({ row, region: "iad" })],
      "5m",
      publisher,
    );

    expect(result).toMatchObject({ success: 1, failed: 0 });
    expect(published).toEqual([
      {
        topic: "checker-iad",
        payload: buildCheckerPayload(input({ row, region: "iad" })),
        attributes: {
          jobType: "tcp",
          periodicity: "5m",
          monitorId: "42",
          region: "iad",
        },
      },
    ]);
  });

  test("publishes both 30s halves at once, 30s apart", async () => {
    const { published, publisher } = recordingPublisher();
    const row = monitorRow({ periodicity: "30s" });
    const timestamp = 1_700_000_000_000;

    await publishCheckerTasks(
      [
        input({ row, timestamp }),
        input({ row, timestamp: timestamp + 30_000 }),
      ],
      "30s",
      publisher,
    );

    expect(published.map((p) => p.topic)).toEqual([
      "checker-ams-30s",
      "checker-ams-30s",
    ]);
    expect(published.map((p) => p.payload.cronTimestamp)).toEqual([
      timestamp,
      timestamp + 30_000,
    ]);
  });

  test("counts failures per region without dropping the rest", async () => {
    const { published, publisher } = recordingPublisher(["checker-gru"]);
    const row = monitorRow({});

    const result = await publishCheckerTasks(
      [
        input({ row, region: "gru" }),
        input({ row, region: "ams" }),
        input({ row, region: "gru" }),
      ],
      "1m",
      publisher,
    );

    expect(result.success).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.failedByRegion).toEqual({ gru: 2 });
    expect(result.errors[0]).toContain("checker-gru");
    expect(published).toHaveLength(1);
  });

  test("does not retry a rejected publish, which would duplicate the check", async () => {
    let calls = 0;
    const failing: CheckerPublisher = {
      publish: () => {
        calls++;
        return Promise.reject(new Error("unavailable"));
      },
    };

    const result = await publishCheckerTasks(
      [input({ row: monitorRow({}) })],
      "1m",
      failing,
    );

    expect(result).toMatchObject({ success: 0, failed: 1 });
    expect(calls).toBe(1);
  });
});

describe("checker-regions.json", () => {
  test("lists every active checker region, so infra has a topic for each", () => {
    const snapshot = z
      .array(z.string())
      .parse(
        JSON.parse(
          readFileSync(
            new URL("./checker-regions.json", import.meta.url),
            "utf8",
          ),
        ),
      );
    const active = Object.values(regionDict)
      .filter((r) => !r.deprecated && r.provider !== "private")
      .map((r) => r.code);

    const missing = active.filter((code) => !snapshot.includes(code));
    expect(
      missing,
      "add these regions to checker-regions.json and to checker_regions in openstatus-org/infra/gcp/pubsub.tf",
    ).toEqual([]);
    expect(snapshot.filter((code) => !active.includes(code))).toEqual([]);
  });
});
