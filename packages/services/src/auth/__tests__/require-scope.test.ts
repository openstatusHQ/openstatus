import type { Scope } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

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
      userId: 1,
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

describe("requireScope group scopes", () => {
  function keyCtx(scopes: Scope[]) {
    return makeCtx({ type: "apiKey", keyId: "k1", scopes });
  }

  test("<group>:write covers the same group's read, not another group", () => {
    const ctx = keyCtx(["monitors:write"]);
    expect(() => requireScope(ctx, "monitors:write")).not.toThrow();
    expect(() => requireScope(ctx, "monitors:read")).not.toThrow();
    expect(() => requireScope(ctx, "pages:read")).toThrow(ForbiddenError);
    expect(() => requireScope(ctx, "pages:write")).toThrow(ForbiddenError);
  });

  test("<group>:read does not cover its own write", () => {
    const ctx = keyCtx(["incidents:read"]);
    expect(() => requireScope(ctx, "incidents:read")).not.toThrow();
    expect(() => requireScope(ctx, "incidents:write")).toThrow(ForbiddenError);
  });

  test("legacy write covers every group, legacy read every read", () => {
    const write = keyCtx(["write"]);
    expect(() => requireScope(write, "subscribers:write")).not.toThrow();
    expect(() => requireScope(write, "subscribers:read")).not.toThrow();
    const read = keyCtx(["read"]);
    expect(() => requireScope(read, "monitors:read")).not.toThrow();
    expect(() => requireScope(read, "subscribers:read")).not.toThrow();
    expect(() => requireScope(read, "monitors:write")).toThrow(ForbiddenError);
  });

  test("admin is satisfied only by '*'", () => {
    expect(() => requireScope(keyCtx(["*"]), "admin")).not.toThrow();
    expect(() => requireScope(keyCtx(["write"]), "admin")).toThrow(
      ForbiddenError,
    );
    expect(() =>
      requireScope(keyCtx(["monitors:write", "pages:write"]), "admin"),
    ).toThrow(ForbiddenError);
  });

  test("any passes any non-empty credential and fails closed on none", () => {
    expect(() =>
      requireScope(keyCtx(["subscribers:read"]), "any"),
    ).not.toThrow();
    expect(() => requireScope(keyCtx([]), "any")).toThrow(ForbiddenError);
  });

  test("mcp actor follows the same group rules", () => {
    const ctx = makeCtx({ type: "mcp", keyId: "k1", scopes: ["pages:write"] });
    expect(() => requireScope(ctx, "pages:read")).not.toThrow();
    expect(() => requireScope(ctx, "incidents:read")).toThrow(ForbiddenError);
  });
});
