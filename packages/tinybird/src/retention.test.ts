import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const types = ["http", "tcp", "dns", "icmp", "grpc"] as const;

const retainedDatasources = [
  "mv__http_status_45d__v1",
  "mv__tcp_status_45d__v1",
  "mv__dns_status_45d__v0",
  "mv__icmp_status_45d__v0",
  "mv__grpc_status_45d__v0",
  ...types.map((t) => `mv__${t}_status_15m__v0`),
  ...types.map((t) => `mv__${t}_runs_45d__v0`),
];

describe.each(retainedDatasources)("%s", (name) => {
  test("keeps 76 days", () => {
    expect(read(`datasources/${name}.datasource`)).toContain(
      'ENGINE_TTL "time + toIntervalDay(76)"',
    );
  });
});

// without a time filter these endpoints would return the whole 76-day TTL
const windowedEndpoints = [
  "endpoint__http_status_45d__v1",
  "endpoint__tcp_status_45d__v1",
  "endpoint__dns_status_45d__v0",
  "endpoint__icmp_status_45d__v0",
  "endpoint__grpc_status_45d__v0",
  ...types.map((t) => `endpoint__${t}_runs_45d__v0`),
];

describe.each(windowedEndpoints)("%s", (name) => {
  test("reads `days` back from today, 45 by default", () => {
    expect(read(`endpoints/${name}.pipe`)).toContain(
      "AND time >= toStartOfDay(now()) - INTERVAL {{ Int16(days, 45) }} DAY",
    );
  });
});

test("heartbeat 45d endpoint reads `days` back from today, 45 by default", () => {
  expect(read("endpoints/endpoint__heartbeat_status_45d__v0.pipe")).toContain(
    "AND timestamp >= toUnixTimestamp64Milli(toDateTime64(toStartOfDay(now() - INTERVAL {{ Int16(days, 45) }} DAY), 3))",
  );
});

describe.each(types)("endpoint__%s_runs_45d__v0 timezone branch", (type) => {
  const pipe = read(`endpoints/endpoint__${type}_runs_45d__v0.pipe`);

  test("groups runs into local days of the scheduled time", () => {
    expect(pipe).toContain("{% if defined(timezone) %}");
    expect(pipe).toContain(
      "toDate(toTimeZone(fromUnixTimestamp64Milli(cronTimestamp), tz)) AS localDay",
    );
  });

  test("keeps the `days` window in the local branch", () => {
    expect(pipe).toContain(
      "AND fromUnixTimestamp64Milli(cronTimestamp) >= toStartOfDay(toTimeZone(now(), tz)) - INTERVAL {{ Int16(days, 45) }} DAY",
    );
  });
});
