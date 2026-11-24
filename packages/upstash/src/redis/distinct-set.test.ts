import { describe, expect, test } from "vitest";

import { addDistinctWithTtl, countDistinct } from "./distinct-set";

function fakeClient(result: number) {
  const calls: { script: string; keys: string[]; args: unknown[] }[] = [];
  const client = {
    eval: <TArgs extends unknown[], TData>(
      script: string,
      keys: string[],
      args: TArgs,
    ) => {
      calls.push({ script, keys, args });
      return Promise.resolve(result as TData);
    },
  };
  return { client, calls };
}

describe("addDistinctWithTtl", () => {
  test("sends the key, member, window and cap in one eval and returns the size", async () => {
    const { client, calls } = fakeClient(3);
    expect(await addDistinctWithTtl(client, "k", "m", 900, 10)).toBe(3);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.keys).toEqual(["k"]);
    expect(calls[0]?.args).toEqual(["m", 900, 10]);
  });

  // Source-level only: no Lua runtime here, so this pins the script's shape.
  test("expires the key only when its first member is added", async () => {
    const { client, calls } = fakeClient(1);
    await addDistinctWithTtl(client, "k", "m", 900, 10);
    const script = calls[0]?.script ?? "";
    expect(script).toMatch(/redis\.call\('SADD', KEYS\[1\], ARGV\[1\]\)/);
    expect(script).toMatch(
      /if added == 1 and size == 1 then\s+redis\.call\('EXPIRE', KEYS\[1\], tonumber\(ARGV\[2\]\)\)\s+end/,
    );
    expect(script.match(/'EXPIRE'/g)).toHaveLength(1);
  });

  // Source-level only: pins the cap check before the SADD.
  test("a full set stores no new member and answers max + 1", async () => {
    const { client, calls } = fakeClient(11);
    await addDistinctWithTtl(client, "k", "m", 900, 10);
    const script = calls[0]?.script ?? "";
    expect(script).toMatch(
      /if size >= max and redis\.call\('SISMEMBER', KEYS\[1\], ARGV\[1\]\) == 0 then\s+return max \+ 1\s+end[\s\S]*'SADD'/,
    );
  });
});

describe("countDistinct", () => {
  test("reads the set size without writing", async () => {
    const { client, calls } = fakeClient(7);
    expect(await countDistinct(client, "k")).toBe(7);
    expect(calls[0]?.script).toMatch(/SCARD/);
    expect(calls[0]?.script).not.toMatch(/SADD|EXPIRE|DEL/);
  });
});
