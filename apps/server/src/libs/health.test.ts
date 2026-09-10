import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { type Probe, runProbes } from "@/libs/health";

function probe(over: Partial<Probe> & Pick<Probe, "name">): Probe {
  return {
    critical: false,
    timeoutMs: 50,
    run: () => Promise.resolve(),
    ...over,
  };
}

describe("runProbes", () => {
  test("is ok when every dependency answers", async () => {
    const report = await runProbes([
      probe({ name: "database", critical: true }),
      probe({ name: "redis" }),
    ]);

    expect(report.status).toBe("ok");
    expect(report.checks.map((c) => c.status)).toEqual(["ok", "ok"]);
    expect(report.checks[0].latencyMs).toBeGreaterThanOrEqual(0);
    expect(report.checkedAt).toMatch(/^\d{4}-/);
  });

  test("a non-critical dependency going down is degraded, not unhealthy", async () => {
    const report = await runProbes([
      probe({ name: "database", critical: true }),
      probe({
        name: "tinybird",
        run: () => Promise.reject(new Error("HTTP 503")),
      }),
    ]);

    expect(report.status).toBe("degraded");
    expect(report.checks[1]).toMatchObject({
      name: "tinybird",
      status: "down",
      error: "HTTP 503",
    });
  });

  test("turso going down is unhealthy", async () => {
    const report = await runProbes([
      probe({
        name: "database",
        critical: true,
        run: () => Promise.reject(new Error("SQLITE_UNKNOWN")),
      }),
      probe({ name: "redis" }),
    ]);

    expect(report.status).toBe("unhealthy");
  });

  test("a hung dependency is down at its own deadline, not the report's", async () => {
    const report = await runProbes([
      probe({ name: "redis", timeoutMs: 20, run: () => new Promise(() => {}) }),
      probe({ name: "database", critical: true }),
    ]);

    expect(report.status).toBe("degraded");
    expect(report.checks[0].error).toBe("timed out after 20ms");
    // Concurrent: the whole report waits for the slowest probe, not their sum.
    expect(report.latencyMs).toBeLessThan(200);
  });

  test("aborts the signal it hands a probe when the deadline passes", async () => {
    let aborted = false;
    await runProbes([
      probe({
        name: "unkey",
        timeoutMs: 20,
        run: (signal) =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              aborted = true;
              reject(new Error("aborted"));
            });
          }),
      }),
    ]);

    expect(aborted).toBe(true);
  });

  test("a probe that throws synchronously is down, not a crash", async () => {
    // `fetch` throws rather than rejects on a malformed URL, which is what a
    // misconfigured base URL produces.
    const report = await runProbes([
      probe({
        name: "tinybird",
        run: () => {
          throw new TypeError("Invalid URL: '/v0/health'");
        },
      }),
    ]);

    expect(report.status).toBe("degraded");
    expect(report.checks[0]).toMatchObject({
      status: "down",
      error: "Invalid URL: '/v0/health'",
    });
  });

  test("that synchronous throw leaves no stray rejection behind", async () => {
    // It never reaches `Promise.race`, so nothing is watching the deadline;
    // rejecting it from the abort in `runProbe`'s `finally` would take the
    // process down. `deno test` swallows that, so assert on a bare process.
    const module = new URL("./health.ts", import.meta.url).href;
    const { code, stderr } = await new Deno.Command(Deno.execPath(), {
      args: [
        "eval",
        "--ext=ts",
        `import { runProbes } from ${JSON.stringify(module)};
         await runProbes([{
           name: "tinybird",
           critical: false,
           timeoutMs: 2000,
           run: () => { throw new TypeError("Invalid URL"); },
         }]);
         await new Promise((r) => setTimeout(r, 20));`,
      ],
    }).output();

    expect(new TextDecoder().decode(stderr)).not.toContain("Uncaught");
    expect(code).toBe(0);
  });

  test("skips a dependency that is switched off", async () => {
    const report = await runProbes([
      probe({
        name: "tinybird",
        skip: () => true,
        run: () => Promise.reject(new Error("must not run")),
      }),
    ]);

    expect(report.status).toBe("ok");
    expect(report.checks[0]).toMatchObject({ status: "skipped", latencyMs: 0 });
  });

  test("truncates probe errors, which carry connection strings", async () => {
    const report = await runProbes([
      probe({
        name: "database",
        run: () => Promise.reject(new Error("x".repeat(500))),
      }),
    ]);

    expect(report.checks[0].error).toHaveLength(201);
    expect(report.checks[0].error?.endsWith("…")).toBe(true);
  });
});
