import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { withTinybirdFallback } from "../tinybird-fallback";

describe("withTinybirdFallback", () => {
  it("returns ok with data when the read resolves in time", async () => {
    const result = await withTinybirdFallback(async () => ({ data: [1, 2] }));
    expect(result).toEqual({ ok: true, data: { data: [1, 2] } });
  });

  it("falls back when the read throws", async () => {
    const result = await withTinybirdFallback(async () => {
      throw new Error("tinybird down");
    });
    expect(result).toEqual({ ok: false, data: null });
  });

  it("falls back when the read exceeds the timeout", async () => {
    // keep a handle on the slow read's timer — deno's leak sanitizer fails
    // the test if it outlives the assertion
    let slowRead!: ReturnType<typeof setTimeout>;
    const result = await withTinybirdFallback(
      () =>
        new Promise((resolve) => {
          slowRead = setTimeout(resolve, 50);
        }),
      10,
    );
    clearTimeout(slowRead);
    expect(result).toEqual({ ok: false, data: null });
  });
});
