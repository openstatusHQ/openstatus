import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { Hono } from "hono";
import { requestId } from "hono/request-id";

import { createConcurrencyGuard } from "./concurrency";

type Env = { Variables: { event: Record<string, unknown> } };

function build(maxInFlight: number) {
  const guard = createConcurrencyGuard({ maxInFlight });
  const events: Record<string, unknown>[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const app = new Hono<Env>();
  app.use("*", requestId());
  app.use("*", async (c, next) => {
    const event: Record<string, unknown> = {};
    events.push(event);
    c.set("event", event);
    await next();
  });
  app.use("*", guard.middleware);
  app.get("/slow", async (c) => {
    await gate;
    return c.text("ok");
  });
  app.get("/fast", (c) => c.text("ok"));
  app.get("/boom", () => {
    throw new Error("boom");
  });
  app.get("/ping", (c) => c.text("pong"));
  app.onError((_, c) => c.text("error", 500));

  return { app, guard, events, release };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("concurrency guard", () => {
  test("requests under the cap pass and report in_flight", async () => {
    const { app, events } = build(4);
    const res = await app.request("/fast");
    expect(res.status).toBe(200);
    expect(events[0].in_flight).toBe(1);
    expect(events[0].shed).toBeUndefined();
  });

  test("request past the cap gets 503 with Retry-After and shed=true", async () => {
    const { app, guard, events, release } = build(2);
    const first = app.request("/slow");
    const second = app.request("/slow");
    await tick();
    expect(guard.inFlight()).toBe(2);

    const shed = await app.request("/slow");
    expect(shed.status).toBe(503);
    expect(shed.headers.get("retry-after")).toBe("5");
    expect(await shed.json()).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      requestId: expect.any(String),
    });
    expect(events[2].shed).toBe(true);
    expect(events[2].in_flight).toBe(2);

    release();
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(guard.inFlight()).toBe(0);
  });

  test("counter decrements when the handler throws", async () => {
    const { app, guard } = build(1);
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    expect(guard.inFlight()).toBe(0);
    expect((await app.request("/fast")).status).toBe(200);
  });

  test("/ping is never shed", async () => {
    const { app, guard, release } = build(1);
    const held = app.request("/slow");
    await tick();
    expect(guard.inFlight()).toBe(1);
    expect((await app.request("/fast")).status).toBe(503);
    expect((await app.request("/ping")).status).toBe(200);
    release();
    await held;
  });

  test("shed response uses the standard error envelope", async () => {
    const { app, release } = build(1);
    const held = app.request("/slow");
    await tick();
    const shed = await app.request("/fast");
    expect(shed.headers.get("content-type")).toContain("application/json");
    expect(await shed.json()).toEqual({
      code: "SERVICE_UNAVAILABLE",
      message: "Server is busy, retry shortly",
      docs: "https://www.openstatus.dev/docs/api-references/errors/code/SERVICE_UNAVAILABLE",
      requestId: expect.any(String),
    });
    release();
    await held;
  });

  test("admits exactly the cap and recovers as requests finish", async () => {
    const guard = createConcurrencyGuard({ maxInFlight: 3 });
    const gates: (() => void)[] = [];
    const app = new Hono();
    app.use("*", guard.middleware);
    app.get("/slow", async (c) => {
      await new Promise<void>((resolve) => gates.push(resolve));
      return c.text("ok");
    });

    const held = [
      app.request("/slow"),
      app.request("/slow"),
      app.request("/slow"),
    ];
    await tick();
    expect(guard.inFlight()).toBe(3);
    expect((await app.request("/slow")).status).toBe(503);

    gates.shift()?.();
    expect((await held[0]).status).toBe(200);
    expect(guard.inFlight()).toBe(2);

    const admitted = app.request("/slow");
    await tick();
    expect(guard.inFlight()).toBe(3);
    for (const g of gates.splice(0)) g();
    for (const r of [held[1], held[2], admitted])
      expect((await r).status).toBe(200);
    expect(guard.inFlight()).toBe(0);
  });

  test("works without a wide event on the context", async () => {
    const guard = createConcurrencyGuard({ maxInFlight: 1 });
    const app = new Hono()
      .use("*", guard.middleware)
      .get("/x", (c) => c.text("ok"));
    expect((await app.request("/x")).status).toBe(200);
    expect(guard.inFlight()).toBe(0);
  });
});
