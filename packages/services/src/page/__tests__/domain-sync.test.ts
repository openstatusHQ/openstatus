import { page as pageTable } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import {
  ConflictError,
  InternalServiceError,
  ValidationError,
} from "../../errors";
import {
  attachDomain,
  detachDomain,
  detachDomainIfUnused,
  reconcileProjectDomains,
  type VercelDomainConfig,
  vercelFetch,
} from "../domain-sync";

const config: VercelDomainConfig = {
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

const errorResponse = (status: number, code: string) =>
  Response.json({ error: { code, message: "vercel internals" } }, { status });

afterEach(() => {
  globalThis.fetch = originalFetch;
});

let workspaceId: number;
beforeAll(async () => {
  workspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

describe("detachDomain", () => {
  test("treats 404 as detached", async () => {
    mockVercel(() => errorResponse(404, "not_found"));
    await detachDomain(config, "gone.example.com");
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("DELETE");
  });

  test("throws on 500", async () => {
    mockVercel(() => errorResponse(500, "internal"));
    await expect(
      detachDomain(config, "boom.example.com"),
    ).rejects.toBeInstanceOf(InternalServiceError);
  });

  test("no-op without config", async () => {
    mockVercel(() => Response.json({}));
    await detachDomain(null, "selfhost.example.com");
    expect(calls).toHaveLength(0);
  });
});

describe("attachDomain", () => {
  test("falls back to GET and accepts an existing attachment", async () => {
    mockVercel(({ method }) =>
      method === "POST"
        ? errorResponse(409, "domain_already_in_use")
        : Response.json({ name: "again.example.com" }),
    );
    await attachDomain(config, "again.example.com");
    expect(calls.map((c) => c.method)).toEqual(["POST", "GET"]);
  });

  test("throws the mapped error when the domain is not attached", async () => {
    mockVercel(({ method }) =>
      method === "POST"
        ? errorResponse(409, "domain_already_in_use")
        : errorResponse(404, "not_found"),
    );
    const error = await attachDomain(config, "taken.example.com").catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).not.toContain("vercel internals");
  });
});

describe("detachDomainIfUnused", () => {
  test("skips when another page holds the domain, proceeds with excludePageId", async () => {
    await withTestTransaction(async (tx) => {
      const domain = `held-${crypto.randomUUID()}.example.com`;
      const holder = await tx
        .insert(pageTable)
        .values({
          workspaceId,
          title: "Holder",
          slug: `svc-domain-sync-${crypto.randomUUID()}`,
          description: "",
          customDomain: domain.toUpperCase(),
        })
        .returning()
        .get();

      mockVercel(() => Response.json({}));
      await detachDomainIfUnused({ db: tx, domain, config });
      expect(calls).toHaveLength(0);

      await detachDomainIfUnused({
        db: tx,
        domain,
        excludePageId: holder.id,
        config,
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("DELETE");
    });
  });
});

describe("reconcileProjectDomains", () => {
  test("splits orphans and missing, skips own domains, follows pagination", async () => {
    await withTestTransaction(async (tx) => {
      const id = crypto.randomUUID();
      const held = `held-${id}.example.com`;
      const orphan = `orphan-${id}.example.com`;
      const missing = `missing-${id}.example.com`;
      for (const domain of [held, missing]) {
        await tx
          .insert(pageTable)
          .values({
            workspaceId,
            title: "Reconcile",
            slug: `svc-domain-sync-${crypto.randomUUID()}`,
            description: "",
            customDomain: domain,
          })
          .run();
      }

      mockVercel(({ method, url }) => {
        if (method === "DELETE") return Response.json({});
        return url.searchParams.has("until")
          ? Response.json({
              domains: [
                { name: orphan },
                { name: "www.x.com", redirect: "x.com" },
              ],
              pagination: { next: null },
            })
          : Response.json({
              domains: [
                { name: held.toUpperCase() },
                { name: "openstatus.dev" },
                { name: "acme.openstatus.dev" },
                { name: "preview.example.com", gitBranch: "main" },
              ],
              pagination: { next: 123 },
            });
      });

      const report = await reconcileProjectDomains({ db: tx, config });
      expect(report.orphans).toEqual([orphan]);
      expect(report.missing).toContain(missing);
      expect(report.missing).not.toContain(held);
      expect(report.detached).toEqual([]);
      expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(0);

      const applied = await reconcileProjectDomains({
        db: tx,
        config,
        apply: true,
      });
      expect(applied.detached).toEqual([orphan]);
      const deletes = calls.filter((c) => c.method === "DELETE");
      expect(deletes).toHaveLength(1);
      expect(deletes[0].url.pathname).toContain(encodeURIComponent(orphan));
    });
  });
});

for (const path of [
  "/v9/projects/p/domains/../../../../v2/user",
  "/v9/projects/p/domains/%2e%2e/%2e%2e/x",
  "/v9/projects/p/domains/a.com#?teamId=t",
  "//evil.example/v2/user",
]) {
  test(`vercelFetch refuses ${path}`, async () => {
    mockVercel(() => {
      throw new Error("unexpected network call");
    });
    const error = await vercelFetch("token", path).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
}
