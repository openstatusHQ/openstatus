import { db, eq } from "@openstatus/db";
import { page as pageTable } from "@openstatus/db/src/schema";
import { afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLogFor,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import {
  ConflictError,
  ForbiddenError,
  LimitExceededError,
  ValidationError,
} from "../../errors";
import { createPage, newPage } from "../create";
import { deletePage } from "../delete";
import type { VercelDomainConfig } from "../domain-sync";
import { setPageCustomDomain } from "../set-custom-domain";

const vercel: VercelDomainConfig = {
  projectId: "prj_test",
  teamId: "team_test",
  token: "token",
};

type Call = { method: string; url: URL; body?: Record<string, unknown> };
const originalFetch = globalThis.fetch;
let calls: Call[] = [];

function mockVercel(handler: (call: Call) => Response) {
  calls = [];
  globalThis.fetch = (input, init) => {
    const request = new Request(input, init);
    const call = {
      method: request.method,
      url: new URL(request.url),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
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
  tx: DB,
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

async function storedDomain(tx: DB, id: number) {
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

  test("clearing against a 500 still writes the row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const id = await pageWithDomain(tx, teamCtx, domain());
      mockVercel(status(500));
      await setPageCustomDomain({ ctx, input: { id, customDomain: "" } });
      expect(await storedDomain(tx, id)).toBe("");
    });
  });

  test("a swap whose detach fails still moves the domain", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const old = domain();
      const next = domain();
      const id = await pageWithDomain(tx, teamCtx, old);

      mockVercel(({ method }) => (method === "DELETE" ? status(500)() : ok()));
      await setPageCustomDomain({ ctx, input: { id, customDomain: next } });
      // The GET looks for a www companion of the old domain to release with it.
      expect(calls.map((c) => c.method)).toEqual(["POST", "GET", "DELETE"]);
      expect(calls[2].url.pathname).toContain(encodeURIComponent(old));
      expect(await storedDomain(tx, id)).toBe(next);
    });
  });

  test("a failed write keeps the previous domain attached", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const old = domain();
      const next = domain();
      const id = await pageWithDomain(tx, teamCtx, old);

      // Another page claims `next` between the availability check and the write.
      let fetches = 0;
      globalThis.fetch = async () => {
        fetches++;
        await pageWithDomain(tx, freeCtx, next);
        return ok();
      };
      await expect(
        setPageCustomDomain({ ctx, input: { id, customDomain: next } }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(fetches).toBe(1);
      expect(await storedDomain(tx, id)).toBe(old);
    });
  });

  test("an unchanged save survives a Vercel failure", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const current = domain();
      const id = await pageWithDomain(tx, teamCtx, current);
      mockVercel(status(500));
      await setPageCustomDomain({ ctx, input: { id, customDomain: current } });
      expect(await storedDomain(tx, id)).toBe(current);
    });
  });

  test("an apex gets a www companion redirecting to it", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const apex = domain();
      const id = await pageWithDomain(tx, teamCtx, "");
      mockVercel(({ method }) =>
        method === "GET"
          ? status(404)()
          : Response.json({ name: apex, apexName: apex }),
      );
      await setPageCustomDomain({ ctx, input: { id, customDomain: apex } });
      expect(calls.map((c) => c.method)).toEqual(["POST", "GET", "POST"]);
      expect(calls[2].body).toEqual({
        name: `www.${apex}`,
        redirect: apex,
        redirectStatusCode: 308,
      });
      expect(await storedDomain(tx, id)).toBe(apex);
    });
  });

  test("a subdomain gets no companion", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const apex = domain();
      const id = await pageWithDomain(tx, teamCtx, "");
      mockVercel(() =>
        Response.json({ name: `status.${apex}`, apexName: apex }),
      );
      await setPageCustomDomain({
        ctx,
        input: { id, customDomain: `status.${apex}` },
      });
      expect(calls.map((c) => c.method)).toEqual(["POST"]);
    });
  });

  test("a companion failure does not fail the save", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const apex = domain();
      const id = await pageWithDomain(tx, teamCtx, "");
      let posts = 0;
      mockVercel(({ method }) => {
        if (method === "GET") return status(404)();
        return posts++ === 0
          ? Response.json({ name: apex, apexName: apex })
          : status(403)();
      });
      await setPageCustomDomain({ ctx, input: { id, customDomain: apex } });
      expect(await storedDomain(tx, id)).toBe(apex);
    });
  });

  test("an unchanged save heals a www alias attached without a redirect", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const apex = domain();
      const id = await pageWithDomain(tx, teamCtx, apex);
      mockVercel(({ method, url }) => {
        if (method === "POST") return status(409)();
        if (method === "GET" && url.pathname.includes(`www.${apex}`)) {
          return Response.json({ name: `www.${apex}`, apexName: apex });
        }
        return Response.json({ name: apex, apexName: apex });
      });
      await setPageCustomDomain({ ctx, input: { id, customDomain: apex } });
      const patch = calls.find((c) => c.method === "PATCH");
      expect(patch?.url.pathname).toContain(`www.${apex}`);
      expect(patch?.body).toEqual({ redirect: apex, redirectStatusCode: 308 });
    });
  });

  test("rejects a domain another page already holds", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const taken = domain();
      await pageWithDomain(tx, freeCtx, taken);
      const id = await pageWithDomain(tx, teamCtx, "");
      mockVercel(ok);
      await expect(
        setPageCustomDomain({
          ctx,
          input: { id, customDomain: taken.toUpperCase() },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(calls).toHaveLength(0);
      expect(await storedDomain(tx, id)).toBe("");
    });
  });

  test("an unchanged domain on a plan without the feature is not rejected", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...freeCtx, db: tx };
      const kept = domain();
      const id = await pageWithDomain(tx, freeCtx, kept);
      mockVercel(ok);
      await setPageCustomDomain({ ctx, input: { id, customDomain: kept } });
      expect(calls.map((c) => c.method)).toEqual(["POST"]);
    });
  });

  test("an unchanged save only re-attaches, writing nothing", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const current = domain();
      const id = await pageWithDomain(tx, teamCtx, current);
      mockVercel(ok);
      await setPageCustomDomain({
        ctx,
        input: { id, customDomain: current.toUpperCase() },
      });
      expect(calls.map((c) => c.method)).toEqual(["POST"]);
      expect(await storedDomain(tx, id)).toBe(current);
    });
  });

  test("an unchanged empty domain makes no Vercel call", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const id = await pageWithDomain(tx, teamCtx, "");
      mockVercel(ok);
      await setPageCustomDomain({ ctx, input: { id, customDomain: "" } });
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

test("createPage rejects a custom domain instead of dropping it", async () => {
  await withTestTransaction(async (tx) => {
    mockVercel(ok);
    await expect(
      createPage({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: "Create",
          description: "",
          slug: `svc-set-domain-${crypto.randomUUID()}`,
          customDomain: domain(),
          workspaceId: teamCtx.workspace.id,
          monitors: [],
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
});

describe("deletePage domain release", () => {
  // Committed db: inside a transaction deletePage deliberately skips Vercel.
  const created: number[] = [];
  afterEach(async () => {
    const ids = created.splice(0);
    for (const id of ids) {
      await db.delete(pageTable).where(eq(pageTable.id, id));
    }
    await clearAuditLogFor({ entityType: "page", entityIds: ids });
  });
  async function committedPage(customDomain: string) {
    const id = await pageWithDomain(db, teamCtx, customDomain);
    created.push(id);
    return id;
  }

  test("deletes the row and detaches the domain", async () => {
    const id = await committedPage(domain());
    mockVercel(ok);
    await deletePage({ ctx: teamCtx, input: { id } });
    expect(calls.map((c) => c.method)).toEqual(["GET", "DELETE"]);
    expect(await storedDomain(db, id)).toBeUndefined();
  });

  test("a Vercel 500 still deletes the row", async () => {
    const id = await committedPage(domain());
    mockVercel(status(500));
    await deletePage({ ctx: teamCtx, input: { id } });
    expect(await storedDomain(db, id)).toBeUndefined();
  });

  test("skips Vercel inside a caller's transaction", async () => {
    await withTestTransaction(async (tx) => {
      const id = await pageWithDomain(tx, teamCtx, domain());
      mockVercel(ok);
      await deletePage({ ctx: { ...teamCtx, db: tx }, input: { id } });
      expect(calls).toHaveLength(0);
      expect(await storedDomain(tx, id)).toBeUndefined();
    });
  });
});
