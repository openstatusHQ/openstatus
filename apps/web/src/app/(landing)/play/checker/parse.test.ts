import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { parseCheckerLine } from "./parse";

const timing = {
  dnsStart: 0,
  dnsDone: 2,
  connectStart: 2,
  connectDone: 3,
  tlsHandshakeStart: 3,
  tlsHandshakeDone: 8,
  firstByteStart: 8,
  firstByteDone: 46,
  transferStart: 46,
  transferDone: 49,
};

describe("parseCheckerLine", () => {
  test("result id", () => {
    const id = "aec4e0ec3c4f4557b8ce46e55078fc95";
    expect(parseCheckerLine(id)).toEqual({ type: "id", id });
  });

  test("successful region", () => {
    const line = JSON.stringify({
      type: "http",
      state: "success",
      region: "ams",
      status: 200,
      latency: 49,
      headers: {},
      timestamp: 1724415466739,
      timing,
      index: 0,
    });
    expect(parseCheckerLine(line)).toEqual({
      type: "success",
      value: { region: "ams", latency: 49, status: 200, timing },
    });
  });

  test("failed region is kept, not dropped", () => {
    const line = JSON.stringify({
      state: "error",
      region: "bom",
      message: "Check failed in this region",
      index: 3,
    });
    expect(parseCheckerLine(line)).toEqual({
      type: "failure",
      value: { region: "bom", message: "Check failed in this region" },
    });
  });

  test("invalid json", () => {
    expect(parseCheckerLine("{not json")).toBeNull();
  });

  test("unknown region", () => {
    const line = JSON.stringify({
      state: "error",
      region: "nowhere",
      message: "x",
    });
    expect(parseCheckerLine(line)).toBeNull();
  });
});
