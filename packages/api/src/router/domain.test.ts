import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import {
  createPage,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterAll, beforeAll, test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { vercelFetch } from "../lib/vercel";
import { createInnerTRPCContext } from "../trpc";

const otherDomain = "domain-idor-test.openstatus.dev";
let otherPageId: number;
let ownWorkspaceId: number;
let ownUserId: number;

function getCaller() {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: String(ownUserId) } },
    // @ts-expect-error - minimal user for test
    user: { id: ownUserId },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: ownWorkspaceId },
  });
  return edgeRouter.createCaller(ctx);
}

beforeAll(async () => {
  const own = await createTestWorkspace();
  ownWorkspaceId = own.workspace.id;
  ownUserId = own.user.id;
  const other = await createTestWorkspace();

  const row = await createPage(other.workspace.id, {
    customDomain: otherDomain,
  });
  otherPageId = row.id;
});

afterAll(async () => {
  await db.delete(page).where(eq(page.id, otherPageId));
});

for (const procedure of [
  "getDomainResponse",
  "getConfigResponse",
  "verifyDomain",
  "getCertificateStatus",
  "issueCertificate",
] as const) {
  test(`domain.${procedure} rejects another workspace's domain`, async () => {
    const error = await getCaller()
      .domain[procedure]({ domain: otherDomain })
      .catch((e) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("NOT_FOUND");
  });

  test(`domain.${procedure} input schema rejects a leading-dot payload`, async () => {
    const error = await getCaller()
      .domain[procedure]({ domain: "../../../../v2/user#" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("BAD_REQUEST");
  });
}

// `customDomainSchema` ends in `.*`, so this passes input validation; owning it
// passes the ownership check. Only the path encoding keeps it inside /domains/.
for (const procedure of [
  "getDomainResponse",
  "getConfigResponse",
  "verifyDomain",
  "getCertificateStatus",
  "issueCertificate",
] as const) {
  test(`domain.${procedure} cannot escape the domains path with an owned traversal domain`, async () => {
    const traversal = `evil-${ownWorkspaceId}.example/../../../../v2/user#`;
    const own = await createPage(ownWorkspaceId, { customDomain: traversal });

    const original = globalThis.fetch;
    const requested: string[] = [];
    globalThis.fetch = (input) => {
      requested.push(String(input));
      return Promise.resolve(Response.json({}));
    };
    try {
      await getCaller().domain[procedure]({ domain: traversal });
      expect(requested.length).toBe(1);
      const url = new URL(requested[0]);
      expect(url.pathname).toContain("/domains/");
      expect(url.pathname).toContain(encodeURIComponent(traversal));
      expect(url.pathname).not.toContain("/v2/user");
      expect(url.searchParams.has("teamId")).toBe(true);
    } finally {
      globalThis.fetch = original;
      await db.delete(page).where(eq(page.id, own.id));
    }
  });
}

test("domain.getDomainResponse reaches Vercel for the workspace's own domain", async () => {
  const ownDomain = `own-${ownWorkspaceId}.openstatus.dev`;
  const own = await createPage(ownWorkspaceId, { customDomain: ownDomain });

  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = (input) => {
    requested = String(input);
    return Promise.resolve(Response.json({ name: ownDomain, verified: true }));
  };
  try {
    const result = await getCaller().domain.getDomainResponse({
      domain: ownDomain.toUpperCase(),
    });
    expect(result?.verified).toBe(true);
    expect(
      new URL(requested).pathname.endsWith(
        `/domains/${ownDomain.toUpperCase()}`,
      ),
    ).toBe(true);
  } finally {
    globalThis.fetch = original;
    await db.delete(page).where(eq(page.id, own.id));
  }
});

async function withOwnDomain(
  vercelResponses: Record<string, unknown>,
  run: (domain: string, requests: Request[]) => Promise<void>,
) {
  // `.invalid` never resolves, so the TLS probe reports no trusted certificate.
  const domain = `ssl-${ownWorkspaceId}-${crypto.randomUUID()}.example.invalid`;
  const own = await createPage(ownWorkspaceId, { customDomain: domain });
  const original = globalThis.fetch;
  const requests: Request[] = [];
  globalThis.fetch = (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    const prefix = new URL(request.url).pathname.split("/")[2];
    return Promise.resolve(Response.json(vercelResponses[prefix] ?? {}));
  };
  try {
    await run(domain, requests);
  } finally {
    globalThis.fetch = original;
    await db.delete(page).where(eq(page.id, own.id));
  }
}

test("domain.issueCertificate orders a cert once DNS points at Vercel", async () => {
  await withOwnDomain(
    { domains: { misconfigured: false }, certs: { id: "cert_1" } },
    async (domain, requests) => {
      const result = await getCaller().domain.issueCertificate({ domain });
      expect(result).toEqual({ issued: true });
      const order = requests.find((r) => r.url.includes("/v8/certs"));
      expect(order?.method).toBe("POST");
      expect(await order?.json()).toEqual({ cns: [domain] });
    },
  );
});

test("domain.issueCertificate skips the order while DNS is misconfigured", async () => {
  await withOwnDomain(
    { domains: { misconfigured: true } },
    async (domain, requests) => {
      const result = await getCaller().domain.issueCertificate({ domain });
      expect(result).toEqual({ issued: false });
      expect(requests.some((r) => r.url.includes("/v8/certs"))).toBe(false);
    },
  );
});

test("domain.getCertificateStatus is not ready without a trusted certificate", async () => {
  await withOwnDomain({ domains: { misconfigured: false } }, async (domain) => {
    const result = await getCaller().domain.getCertificateStatus({ domain });
    expect(result).toEqual({ ready: false });
  });
});

for (const path of [
  "/v9/projects/p/domains/../../../../v2/user",
  "/v9/projects/p/domains/%2e%2e/%2e%2e/x",
  "/v9/projects/p/domains/a.com#?teamId=t",
  "//evil.example/v2/user",
]) {
  test(`vercelFetch refuses ${path}`, async () => {
    const error = await vercelFetch(path).catch((e) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("BAD_REQUEST");
  });
}
