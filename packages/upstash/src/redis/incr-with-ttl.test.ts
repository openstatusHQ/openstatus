import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { incrWithTtl } from "./incr-with-ttl";

function fakeClient(counts: number[]) {
  const calls: { script: string; keys: string[]; args: unknown[] }[] = [];
  const client = {
    eval: (script: string, keys: string[], args: unknown[]) => {
      calls.push({ script, keys, args });
      return Promise.resolve(counts);
    },
  };
  return { client: client as never, calls };
}

describe("incrWithTtl", () => {
  test("sends every key in one eval with the shared window", async () => {
    const { client, calls } = fakeClient([3, 1]);

    const counts = await incrWithTtl(client, ["a", "b"], 600);

    expect(counts).toEqual([3, 1]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.keys).toEqual(["a", "b"]);
    expect(calls[0]?.args).toEqual([600]);
  });

  test("the script sets the TTL only on the key's first hit", () => {
    const { client, calls } = fakeClient([1]);
    incrWithTtl(client, ["a"], 600);

    const script = calls[0]?.script ?? "";
    expect(script).toContain("for i, key in ipairs(KEYS)");
    expect(script).toContain("redis.call('INCR', key)");
    expect(script).toContain("if count == 1 then");
    expect(script).toContain("redis.call('EXPIRE', key, tonumber(ARGV[1]))");
  });

  test("propagates client failures", async () => {
    const client = {
      eval: () => Promise.reject(new Error("redis down")),
    } as never;

    await expect(incrWithTtl(client, ["a"], 600)).rejects.toThrow("redis down");
  });
});
