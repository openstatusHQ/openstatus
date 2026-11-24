import { describe, expect, test } from "vitest";

import { decrOrDelete } from "./decr-or-delete";

describe("decrOrDelete", () => {
  test("sends one eval for the key and returns the count left", async () => {
    const calls: { keys: string[]; args: unknown[] }[] = [];
    const client = {
      eval: <TArgs extends unknown[], TData>(
        _script: string,
        keys: string[],
        args: TArgs,
      ) => {
        calls.push({ keys, args });
        return Promise.resolve(2 as TData);
      },
    };

    expect(await decrOrDelete(client, "k")).toBe(2);
    expect(calls).toEqual([{ keys: ["k"], args: [] }]);
  });

  // Source-level only: no Lua runtime here, so this pins the script's shape.
  test("deletes the key once the count reaches zero", async () => {
    let script = "";
    await decrOrDelete(
      {
        eval: <TArgs extends unknown[], TData>(
          s: string,
          _k: string[],
          _a: TArgs,
        ) => {
          script = s;
          return Promise.resolve(0 as TData);
        },
      },
      "k",
    );
    expect(script).toMatch(/local count = redis\.call\('DECR', KEYS\[1\]\)/);
    expect(script).toMatch(
      /if count <= 0 then\s+redis\.call\('DEL', KEYS\[1\]\)\s+return 0\s+end/,
    );
    // DEL appears only inside that guard.
    expect(script.match(/'DEL'/g)).toHaveLength(1);
  });
});
