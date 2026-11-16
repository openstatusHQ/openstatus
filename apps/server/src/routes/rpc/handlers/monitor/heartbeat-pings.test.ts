import { HeartbeatPingKind } from "@openstatus/proto/monitor/v1";
import { describe, expect, test } from "vitest";

import { heartbeatPingKindToString } from "./converters";
import {
  decodePingCursor,
  encodePingCursor,
  toHeartbeatPing,
} from "./heartbeat-pings";

describe("toHeartbeatPing", () => {
  test("maps a full ping", () => {
    const ping = toHeartbeatPing(
      {
        id: "ping-1",
        timestamp: 1_767_225_600_000,
        ip: "203.0.113.7",
        method: "POST",
        userAgent: "curl/8.0",
        headers: { "x-job": "backup" },
        body: "stack trace",
        bodyTruncated: true,
        kind: "fail",
      },
      42,
    );

    expect(ping).toMatchObject({
      id: "ping-1",
      monitorId: "42",
      timestamp: 1_767_225_600_000n,
      kind: HeartbeatPingKind.FAIL,
      method: "POST",
      ip: "203.0.113.7",
      userAgent: "curl/8.0",
      headers: { "x-job": "backup" },
      body: "stack trace",
      bodyTruncated: true,
    });
  });

  test("leaves missing fields unset", () => {
    const ping = toHeartbeatPing(
      {
        id: "ping-2",
        timestamp: 1,
        ip: null,
        method: "GET",
        userAgent: null,
        headers: {},
        body: null,
        bodyTruncated: false,
        kind: "success",
      },
      1,
    );

    expect(ping.kind).toBe(HeartbeatPingKind.SUCCESS);
    expect(ping.ip).toBeUndefined();
    expect(ping.userAgent).toBeUndefined();
    expect(ping.body).toBeUndefined();
  });
});

describe("heartbeatPingKindToString", () => {
  test("maps defined kinds and rejects unspecified", () => {
    expect(heartbeatPingKindToString(HeartbeatPingKind.SUCCESS)).toBe(
      "success",
    );
    expect(heartbeatPingKindToString(HeartbeatPingKind.FAIL)).toBe("fail");
    expect(heartbeatPingKindToString(HeartbeatPingKind.UNSPECIFIED)).toBeNull();
  });
});

describe("ping cursor", () => {
  test("round-trips a timestamp", () => {
    const cursor = encodePingCursor(1_767_225_600_000);
    expect(cursor).toMatch(/^[\w-]+$/);
    expect(decodePingCursor(cursor)).toBe(1_767_225_600_000);
  });

  test.each([
    ["garbage", "not a cursor"],
    ["a raw timestamp", "1767225600000"],
    ["a wrong prefix", Buffer.from("v2:1").toString("base64url")],
    ["a negative value", Buffer.from("v1:-5").toString("base64url")],
    ["a fraction", Buffer.from("v1:1.5").toString("base64url")],
    [
      "an unsafe integer",
      Buffer.from("v1:9999999999999999").toString("base64url"),
    ],
    ["an empty value", Buffer.from("v1:").toString("base64url")],
  ])("rejects %s", (_, cursor) => {
    expect(decodePingCursor(cursor)).toBeNull();
  });
});
