import { eq } from "@openstatus/db";
import { page as pageTable } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import {
  ForbiddenError,
  InternalServiceError,
  LimitExceededError,
  ValidationError,
} from "../../errors";
import { newPage } from "../create";
import { deletePage } from "../delete";
import type { VercelDomainConfig } from "../domain-sync";
import { setPageCustomDomain } from "../set-custom-domain";

const vercel: VercelDomainConfig = {
  projectId: "prj_test",
  teamId: "team_test",
  token: "token",
};

type Call = { method: string; url: URL };
const originalFetch = globalThis.fetch;
let calls: Call[] = [];

function mockVercel(handler: (call: Call) => Response) {
  calls = [];
  globalThis.fetch = (input, init) => {
    const request = new Request(input, init);
    const call = { method: request.method, url: new URL(request.url) };
    calls.push(call);
    return Promise.resolve(handler(call));
  };
}

const ok = () => Response.json({});
const status = (code: number) => () =>
  Response.json({ error: { code: "x" } }, { status: code });

afterEach(() => {
  globalThis.fetch = originalFetch;
});

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
beforeAll(async () => {
  teamCtx = {
    ...makeUserCtx((await createWorkspaceFixture("team")).workspace),
    vercel,
  };
  freeCtx = {
    ...makeUserCtx((await createWorkspaceFixture("free")).workspace),
    vercel,
  };
});

async function pageWithDomain(
  tx: DrizzleTx,
  ctx: ServiceContext,
  customDomain: string,
) {
  const p = await newPage({
    ctx: { ...ctx, db: tx },
    input: { title: "Domain", slug: `svc-set-domain-${crypto.randomUUID()}` },
  });
  if (customDomain) {
    await tx
      .update(pageTable)
      .set({ customDomain })
      .where(eq(pageTable.id, p.id))
      .run();
  }
  return p.id;
}

async function storedDomain(tx: DrizzleTx, id: number) {
  const row = await tx
    .select({ customDomain: pageTable.customDomain })
    .from(pageTable)
    .where(eq(pageTable.id, id))
    .get();
  return row?.customDomain;
}

const domain = () => `${crypto.randomUUID()}.example.com`;

describe("setPageCustomDomain", () => {
  test("clearing against a 404 still writes the row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const id = await pageWithDomain(tx, teamCtx, domain());
      mockVercel(status(404));
      await setPageCustomDomain({ ctx, input: { id, customDomain: "" } });
      expect(await storedDomain(tx, id)).toBe("");
    });
  });

  test("clearing against a 500 leaves the row unchanged", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const old = domain();
      const id = await pageWithDomain(tx, teamCtx, old);
      mockVercel(status(500));
      await expect(
        setPageCustomDomain({ ctx, input: { id, customDomain: "" } }),
      ).rejects.toBeInstanceOf(InternalServiceError);
      expect(await storedDomain(tx, id)).toBe(old);
    });
  });

  test("a swap whose detach fails is retryable", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const old = domain();
      const next = domain();
      const id = await pageWithDomain(tx, teamCtx, old);

      mockVercel(({ method }) => (method === "DELETE" ? status(500)() : ok()));
      await expect(
        setPageCustomDomain({ ctx, input: { id, customDomain: next } }),
      ).rejects.toBeInstanceOf(InternalServiceError);
      expect(await storedDomain(tx, id)).toBe(old);

      // retry: attach reports "already attached", GET confirms, detach succeeds
      mockVercel(({ method }) =>
        method === "POST" ? status(409)() : Response.json({ name: next }),
      );
      await setPageCustomDomain({ ctx, input: { id, customDomain: next } });
      expect(calls.map((c) => c.method)).toEqual(["POST", "GET", "DELETE"]);
      expect(await storedDomain(tx, id)).toBe(next);
    });
  });

  test("an unchanged save makes no Vercel call", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const current = domain();
      const id = await pageWithDomain(tx, teamCtx, current);
      mockVercel(ok);
      await setPageCustomDomain({
        ctx,
        input: { id, customDomain: current.toUpperCase() },
      });
      expect(calls).toHaveLength(0);
    });
  });

  test("rejects an 'openstatus' substring", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const id = await pageWithDomain(tx, teamCtx, "");
      mockVercel(ok);
      await expect(
        setPageCustomDomain({
          ctx,
          input: { id, customDomain: "status.openstatus.example.com" },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(calls).toHaveLength(0);
    });
  });

  test("enforces the custom-domain limit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...freeCtx, db: tx };
      const id = await pageWithDomain(tx, freeCtx, "");
      mockVercel(ok);
      await expect(
        setPageCustomDomain({ ctx, input: { id, customDomain: domain() } }),
      ).rejects.toBeInstanceOf(LimitExceededError);
      expect(calls).toHaveLength(0);
    });
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(teamCtx.workspace, {
      keyId: "read-only",
      scopes: ["read"],
    });
    await expect(
      setPageCustomDomain({ ctx, input: { id: 1, customDomain: "" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("deletePage domain release", () => {
  test("detaches the domain, then deletes the row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const id = await pageWithDomain(tx, teamCtx, domain());
      mockVercel(ok);
      await deletePage({ ctx, input: { id } });
      expect(calls.map((c) => c.method)).toEqual(["DELETE"]);
      expect(await storedDomain(tx, id)).toBeUndefined();
    });
  });

  test("a Vercel 500 keeps the row and surfaces the error", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const current = domain();
      const id = await pageWithDomain(tx, teamCtx, current);
      mockVercel(status(500));
      await expect(deletePage({ ctx, input: { id } })).rejects.toBeInstanceOf(
        InternalServiceError,
      );
      expect(await storedDomain(tx, id)).toBe(current);
    });
  });

  test("releaseDomain: false makes no call", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const id = await pageWithDomain(tx, teamCtx, domain());
      mockVercel(ok);
      await deletePage({ ctx, input: { id }, releaseDomain: false });
      expect(calls).toHaveLength(0);
      expect(await storedDomain(tx, id)).toBeUndefined();
    });
  });
});
