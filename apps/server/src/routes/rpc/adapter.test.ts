import { Code, ConnectError } from "@connectrpc/connect";
import type { Workspace } from "@openstatus/db/src/schema";
import {
  ForbiddenError,
  NotFoundError,
  type ServiceContext,
  ValidationError,
} from "@openstatus/services";
import { createApiKey } from "@openstatus/services/api-key";
import { SEEDED_WORKSPACE_TEAM_ID } from "@openstatus/services/test/fixtures";
import {
  loadSeededWorkspace,
  withTestTransaction,
} from "@openstatus/services/test/helpers";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import { toConnectError, toServiceCtx } from "./adapter";

const wsStub = { id: 1, slug: "ws", name: "ws" } as unknown as Workspace;

describe("toServiceCtx (RPC)", () => {
  test("propagates apiKey.scopes onto actor.scopes", () => {
    const ctx = toServiceCtx({
      workspace: wsStub,
      requestId: "req-1",
      apiKey: { id: "k1", createdById: 7, scopes: ["read"] },
    });
    expect(ctx.actor.type).toBe("apiKey");
    if (ctx.actor.type === "apiKey") {
      expect(ctx.actor.scopes).toEqual(["read"]);
      expect(ctx.actor.keyId).toBe("k1");
      expect(ctx.actor.userId).toBe(7);
    }
  });

  test("propagates ['*'] super-admin scopes intact", () => {
    const ctx = toServiceCtx({
      workspace: wsStub,
      requestId: "req-2",
      apiKey: { id: "sa", scopes: ["*"] },
    });
    if (ctx.actor.type === "apiKey") {
      expect(ctx.actor.scopes).toEqual(["*"]);
    }
  });
});

/**
 * `toConnectError` is the only RPC-specific layer between a thrown
 * `ServiceError` and what the wire surfaces. The unique RBAC concern
 * here is the FORBIDDEN → PermissionDenied mapping; the other branches
 * are exercised below for sanity (so the FORBIDDEN test would catch a
 * future refactor that flattens every code into Internal).
 */
/**
 * `toConnectError` always throws — capture the thrown value and
 * assert on it. Avoids `expect.unreachable` (typed `never`, which
 * trips TS's unreachable-code analysis on the catch block).
 */
function captureThrow(fn: () => void): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected fn to throw, but it returned");
}

describe("toConnectError", () => {
  test("ForbiddenError → ConnectError(PermissionDenied)", () => {
    const err = captureThrow(() =>
      toConnectError(new ForbiddenError("API key lacks required scope: write")),
    );
    expect(err).toBeInstanceOf(ConnectError);
    expect((err as ConnectError).code).toBe(Code.PermissionDenied);
    expect((err as ConnectError).rawMessage).toContain(
      "API key lacks required scope",
    );
  });

  test("NotFoundError → ConnectError(NotFound)", () => {
    const err = captureThrow(() =>
      toConnectError(new NotFoundError("monitor", 42)),
    );
    expect((err as ConnectError).code).toBe(Code.NotFound);
  });

  test("ValidationError → ConnectError(InvalidArgument)", () => {
    const err = captureThrow(() =>
      toConnectError(new ValidationError("bad input")),
    );
    expect((err as ConnectError).code).toBe(Code.InvalidArgument);
  });

  test("re-throws an existing ConnectError unchanged", () => {
    const original = new ConnectError("custom", Code.Aborted);
    const err = captureThrow(() => toConnectError(original));
    expect(err).toBe(original);
  });
});

/**
 * RPC runtime sample (per the plan's test plan #8). End-to-end through
 * the layers a real request would hit:
 *   1. Build an apiKey-actor `ServiceContext` via the RPC adapter
 *      (with `['read']` scopes) — the same shape `authInterceptor` would
 *      produce for a read-only key.
 *   2. Invoke a service write verb (`createApiKey` is convenient — same
 *      package, no foreign-key fixtures).
 *   3. Catch the `ForbiddenError` and pipe it through `toConnectError`,
 *      assert the wire code is `PermissionDenied`.
 *
 * One representative method is enough — service-level enforcement
 * covers the rest, this test pins the *RPC translation* of the
 * denial.
 */
describe("RPC runtime — read-only key on a write service verb", () => {
  let teamWorkspace: Workspace;

  beforeAll(async () => {
    teamWorkspace = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  });

  test("throws ForbiddenError → ConnectError(PermissionDenied)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx: ServiceContext = {
        ...toServiceCtx({
          workspace: teamWorkspace,
          requestId: "req-rpc-runtime",
          apiKey: { id: "read-only-key", createdById: 1, scopes: ["read"] },
        }),
        db: tx,
      };

      let captured: unknown;
      try {
        await createApiKey({
          ctx,
          input: { name: "rpc-runtime-test" },
        });
      } catch (err) {
        captured = err;
      }

      expect(captured).toBeInstanceOf(ForbiddenError);

      // Pipe the service error through the RPC mapper — the same
      // path the Connect handler in production takes.
      const mapped = captureThrow(() => toConnectError(captured));
      expect(mapped).toBeInstanceOf(ConnectError);
      expect((mapped as ConnectError).code).toBe(Code.PermissionDenied);
    });
  });
});
