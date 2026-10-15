import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { parseCheckerLine, splitStreamLines } from "./parse";

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

describe("splitStreamLines", () => {
  test("keeps an unfinished line for the next read", () => {
    expect(splitStreamLines('{"a":1}\n{"b":', false)).toEqual({
      lines: ['{"a":1}'],
      rest: '{"b":',
    });
  });

  test("flushes the tail when the stream is done", () => {
    const id = "aec4e0ec3c4f4557b8ce46e55078fc95";
    expect(splitStreamLines(`{"a":1}\n${id}`, true)).toEqual({
      lines: ['{"a":1}', id],
      rest: "",
    });
  });

  test("a failed region split across chunks is still parsed", () => {
    const record = `${JSON.stringify({
      state: "error",
      region: "bom",
      message: "Check failed in this region",
      index: 3,
    })}\n`;
    const chunks = [record.slice(0, 20), record.slice(20)];

    let buffer = "";
    const parsed = [];
    for (const [i, chunk] of chunks.entries()) {
      buffer += chunk;
      const { lines, rest } = splitStreamLines(buffer, i === chunks.length - 1);
      buffer = rest;
      parsed.push(...lines.map(parseCheckerLine));
    }

    expect(parsed).toEqual([
      {
        type: "failure",
        value: { region: "bom", message: "Check failed in this region" },
      },
    ]);
  });
});
