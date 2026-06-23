import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import type { Actor, ServiceContext } from "../../context";
import { ForbiddenError } from "../../errors";
import { requireScope } from "../require-scope";

const workspace = {
  id: 1,
  name: "test",
  slug: "test",
} as unknown as ServiceContext["workspace"];

function makeCtx(actor: Actor): ServiceContext {
  return { workspace, actor };
}

describe("requireScope", () => {
  test("read-only apiKey + 'write' requirement → ForbiddenError", () => {
    const ctx = makeCtx({
      type: "apiKey",
      keyId: "k1",
      scopes: ["read"],
    });
    expect(() => requireScope(ctx, "write")).toThrow(ForbiddenError);
  });

  test("read-only apiKey + 'read' requirement → passes", () => {
    const ctx = makeCtx({
      type: "apiKey",
      keyId: "k1",
      scopes: ["read"],
    });
    expect(() => requireScope(ctx, "read")).not.toThrow();
  });

  test("write apiKey passes 'read' and 'write'", () => {
    const ctx = makeCtx({
      type: "apiKey",
      keyId: "k1",
      scopes: ["write"],
    });
    expect(() => requireScope(ctx, "read")).not.toThrow();
    expect(() => requireScope(ctx, "write")).not.toThrow();
  });

  test("super-admin '*' apiKey passes any required", () => {
    const ctx = makeCtx({
      type: "apiKey",
      keyId: "k1",
      scopes: ["*"],
    });
    expect(() => requireScope(ctx, "read")).not.toThrow();
    expect(() => requireScope(ctx, "write")).not.toThrow();
  });

  test("read-only mcp actor enforced same as apiKey", () => {
    const ctx = makeCtx({
      type: "mcp",
      keyId: "k1",
      scopes: ["read"],
    });
    expect(() => requireScope(ctx, "write")).toThrow(ForbiddenError);
    expect(() => requireScope(ctx, "read")).not.toThrow();
  });

  test("user actor is no-op (member-role enforcement is a separate project)", () => {
    const ctx = makeCtx({ type: "user", userId: 42 });
    expect(() => requireScope(ctx, "write")).not.toThrow();
    expect(() => requireScope(ctx, "read")).not.toThrow();
  });

  test("system actor is no-op", () => {
    const ctx = makeCtx({ type: "system", job: "checker" });
    expect(() => requireScope(ctx, "write")).not.toThrow();
  });

  test("slack actor is no-op", () => {
    const ctx = makeCtx({
      type: "slack",
      teamId: "T1",
      slackUserId: "U1",
    });
    expect(() => requireScope(ctx, "write")).not.toThrow();
  });

  test("webhook actor is no-op", () => {
    const ctx = makeCtx({ type: "webhook", source: "stripe" });
    expect(() => requireScope(ctx, "write")).not.toThrow();
  });

  test("subscriber actor is no-op", () => {
    const ctx = makeCtx({ type: "subscriber", subscriberId: 7 });
    expect(() => requireScope(ctx, "write")).not.toThrow();
  });

  test("apiKey with empty scopes fails closed", () => {
    const ctx = makeCtx({
      type: "apiKey",
      keyId: "k1",
      scopes: [],
    });
    expect(() => requireScope(ctx, "read")).toThrow(ForbiddenError);
    expect(() => requireScope(ctx, "write")).toThrow(ForbiddenError);
  });
});
