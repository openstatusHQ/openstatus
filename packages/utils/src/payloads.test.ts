import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  DNSPayloadSchema,
  grpcPayloadSchema,
  httpPayloadSchema,
  icmpPayloadSchema,
  tpcPayloadSchema,
} from "./payloads";

const common = {
  workspaceId: "1",
  monitorId: "2",
  status: "active",
  cronTimestamp: 1_700_000_000_000,
  degradedAfter: null,
};

describe("httpPayloadSchema", () => {
  const minimal = {
    ...common,
    method: "GET",
    url: "https://openstatus.dev",
    assertions: null,
  };

  it("applies defaults", () => {
    const parsed = httpPayloadSchema.parse(minimal);
    expect(parsed.timeout).toBe(45000);
    expect(parsed.retry).toBe(3);
    expect(parsed.trigger).toBe("cron");
    expect(parsed.followRedirects).toBe(true);
  });

  it("keeps explicit values over defaults", () => {
    const parsed = httpPayloadSchema.parse({
      ...minimal,
      timeout: 1000,
      retry: 0,
      trigger: "api",
      followRedirects: false,
    });
    expect(parsed).toMatchObject({
      timeout: 1000,
      retry: 0,
      trigger: "api",
      followRedirects: false,
    });
  });

  it("rejects an unknown method", () => {
    expect(
      httpPayloadSchema.safeParse({ ...minimal, method: "FETCH" }).success,
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(
      httpPayloadSchema.safeParse({ ...minimal, status: "paused" }).success,
    ).toBe(false);
  });

  it("keeps unknown assertion fields so later schemas can parse them", () => {
    const parsed = httpPayloadSchema.parse({
      ...minimal,
      assertions: [{ type: "status", compare: "eq", target: 200 }],
    });
    expect(parsed.assertions).toEqual([
      { version: "v1", type: "status", compare: "eq", target: 200 },
    ]);
  });
});

describe("non-HTTP payload schemas", () => {
  const withUri = { ...common, uri: "openstatus.dev:443" };

  for (const [name, schema, extra] of [
    ["tcp", tpcPayloadSchema, { assertions: null }],
    ["dns", DNSPayloadSchema, { assertions: null }],
    ["icmp", icmpPayloadSchema, {}],
    ["grpc", grpcPayloadSchema, {}],
  ] as const) {
    it(`${name} applies timeout, retry and trigger defaults`, () => {
      const parsed = schema.parse({ ...withUri, ...extra });
      expect(parsed).toMatchObject({
        timeout: 45000,
        retry: 3,
        trigger: "cron",
      });
    });
  }

  it("grpc defaults to tls", () => {
    expect(grpcPayloadSchema.parse(withUri).tls).toBe("tls");
  });

  it("grpc rejects an unknown tls mode", () => {
    expect(
      grpcPayloadSchema.safeParse({ ...withUri, tls: "mtls" }).success,
    ).toBe(false);
  });
});
