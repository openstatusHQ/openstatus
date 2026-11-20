import { db, eq } from "@openstatus/db";
import {
  page,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import {
  createPage,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

// Self-hosted instance: `SELF_HOST` reaches the routers through `env`.
vi.mock("../env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../env")>();
  return { env: { ...actual.env, SELF_HOST: "true" } };
});

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// Contains "openstatus" on purpose: hosted rejects it, self-hosted must not.
const firstDomain = `internal-${suffix}.openstatus.example.com`;
const secondDomain = `status-${suffix}.example.com`;

let pageId: number;
let caller: ReturnType<typeof edgeRouter.createCaller>;

const realFetch = globalThis.fetch;
let vercelCalls = 0;

beforeAll(async () => {
  const fixture = await createTestWorkspace();
  const row = await createPage(fixture.workspace.id);
  pageId = row.id;
  caller = edgeRouter.createCaller(
    createInnerTRPCContext({
      req: undefined,
      session: { user: { id: String(fixture.user.id) } },
      // @ts-expect-error - minimal user for test
      user: { id: fixture.user.id },
      workspace: selectWorkspaceSchema.parse(
        await db
          .select()
          .from(workspace)
          .where(eq(workspace.id, fixture.workspace.id))
          .get(),
      ),
    }),
  );
});

beforeEach(() => {
  vercelCalls = 0;
  // Count, never send: self-hosted must not reach the Vercel API at all.
  // Anything else (e.g. analytics fired after a successful mutation) gets an
  // empty answer so it can neither leave the process nor skew the count.
  globalThis.fetch = (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("api.vercel.com")) {
      vercelCalls++;
      return Promise.reject(new Error("unexpected Vercel request"));
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

async function storedDomain() {
  const row = await db.select().from(page).where(eq(page.id, pageId)).get();
  return row?.customDomain;
}

describe("self-hosted custom domains", () => {
  test("setting a domain containing 'openstatus' updates the row without Vercel", async () => {
    await caller.page.updateCustomDomain({
      id: pageId,
      customDomain: firstDomain,
    });
    expect(await storedDomain()).toBe(firstDomain);
    expect(vercelCalls).toBe(0);
  });

  test("domain status endpoints answer without Vercel", async () => {
    const domain = await caller.domain.getDomainResponse({
      domain: firstDomain,
    });
    expect(domain).toMatchObject({ name: firstDomain, verified: true });
    expect(domain?.error).toBeUndefined();

    expect(
      await caller.domain.getConfigResponse({ domain: firstDomain }),
    ).toMatchObject({ misconfigured: false });
    expect(
      await caller.domain.verifyDomain({ domain: firstDomain }),
    ).toMatchObject({ name: firstDomain, verified: true });
    expect(
      await caller.domain.getCertificateStatus({ domain: firstDomain }),
    ).toEqual({ ready: true });
    expect(
      await caller.domain.issueCertificate({ domain: firstDomain }),
    ).toEqual({ issued: false });
    expect(vercelCalls).toBe(0);
  });

  test("replacing the domain updates the row without Vercel", async () => {
    await caller.page.updateCustomDomain({
      id: pageId,
      customDomain: secondDomain,
    });
    expect(await storedDomain()).toBe(secondDomain);
    expect(vercelCalls).toBe(0);
  });

  test("clearing the domain empties the row without Vercel", async () => {
    await caller.page.updateCustomDomain({ id: pageId, customDomain: "" });
    expect(await storedDomain()).toBe("");
    expect(vercelCalls).toBe(0);
  });
});
