import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Tinybird } from "@chronark/zod-bird";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

import { TinybirdHttpError, tinybirdFetch, withStatusErrors } from "./fetch";

const noSleep = () => Promise.resolve();

function respond(...responses: Response[]) {
  const mock = vi.fn<typeof fetch>();
  for (const r of responses) mock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", mock);
  return mock;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tinybirdFetch", () => {
  test("returns the body of a successful response", async () => {
    respond(json({ data: [1] }));
    await expect(
      tinybirdFetch("https://tb.test", {}, noSleep),
    ).resolves.toEqual({ data: [1] });
  });

  test("retries 429 and 5xx, then succeeds", async () => {
    const mock = respond(
      json({ error: "slow down" }, 429),
      json({ error: "boom" }, 503),
      json({ data: [] }),
    );
    await expect(
      tinybirdFetch("https://tb.test", {}, noSleep),
    ).resolves.toEqual({ data: [] });
    expect(mock).toHaveBeenCalledTimes(3);
  });

  test("throws the last status once retries run out", async () => {
    const mock = vi.fn<typeof fetch>(async () =>
      json({ error: "Too many simultaneous requests" }, 429),
    );
    vi.stubGlobal("fetch", mock);

    const err = await tinybirdFetch("https://tb.test", {}, noSleep).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(TinybirdHttpError);
    expect((err as TinybirdHttpError).status).toBe(429);
    expect((err as Error).message).toBe(
      "Tinybird 429 after 10 attempts: Too many simultaneous requests",
    );
    expect(mock).toHaveBeenCalledTimes(10);
  });

  test("does not retry other client errors", async () => {
    const mock = respond(json({ error: "[Error] Missing columns" }, 400));
    await expect(
      tinybirdFetch("https://tb.test", {}, noSleep),
    ).rejects.toMatchObject({
      status: 400,
      message: "[Error] Missing columns",
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  test("keeps a non-JSON error body readable", async () => {
    respond(new Response("<html>Bad Gateway</html>", { status: 404 }));
    await expect(
      tinybirdFetch("https://tb.test", {}, noSleep),
    ).rejects.toMatchObject({
      status: 404,
      message: "<html>Bad Gateway</html>",
    });
  });
});

test("pipes built on a wrapped client surface the Tinybird status", async () => {
  respond(json({ error: "[Error] Missing columns" }, 400));
  const pipe = withStatusErrors(new Tinybird({ token: "t" })).buildPipe({
    pipe: "endpoint__test__v0",
    data: z.object({ id: z.string() }),
  });

  await expect(pipe({})).rejects.toMatchObject({
    name: "TinybirdHttpError",
    status: 400,
  });
});

test("the unfiltered latest read is bounded to the last day", () => {
  const pipe = readFileSync(
    join(
      import.meta.dirname,
      "../endpoints/endpoint__external_status_latest__v1.pipe",
    ),
    "utf8",
  );
  expect(pipe).toMatch(
    /\{% else %\}[\s\S]*WHERE fetched_at >= toUnixTimestamp64Milli\(now64\(3\) - INTERVAL 1 DAY\)[\s\S]*\{% end %\}/,
  );
});
