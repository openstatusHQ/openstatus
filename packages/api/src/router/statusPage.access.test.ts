import { db, eq } from "@openstatus/db";
import { page, pageComponent, statusReport } from "@openstatus/db/src/schema";
import {
  createPage,
  createPageComponent,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { NextRequest } from "next/server.js";

import { appRouter } from "../root";
import { createInnerTRPCContext, createTRPCContext } from "../trpc";

const PASSWORD = "s3cret-pw";
let workspaceId: number;
const slugs = {} as Record<
  "public" | "password" | "email-domain" | "ip-restriction",
  string
>;
const reportIds = {} as Record<keyof typeof slugs, number>;
const pageIds = {} as Record<keyof typeof slugs, number>;

function caller(opts?: { headers?: Record<string, string>; email?: string }) {
  return appRouter.createCaller(
    createInnerTRPCContext({
      req: new NextRequest("http://rsc.internal", { headers: opts?.headers }),
      session: opts?.email ? { user: { email: opts.email } } : null,
    }),
  );
}

beforeAll(async () => {
  const fixture = await createTestWorkspace();
  workspaceId = fixture.workspace.id;

  const variants = {
    public: {},
    password: { password: PASSWORD },
    "email-domain": { authEmailDomains: "acme.com" },
    "ip-restriction": { allowedIpRanges: "10.0.0.0/8" },
  } as const;

  for (const accessType of Object.keys(variants) as (keyof typeof slugs)[]) {
    const _page = await createPage(workspaceId, {
      accessType,
      ...variants[accessType],
    });
    slugs[accessType] = _page.slug;
    pageIds[accessType] = _page.id;
    await createPageComponent(workspaceId, _page.id);
    const report = await db
      .insert(statusReport)
      .values({
        workspaceId,
        pageId: _page.id,
        title: "confidential incident",
        status: "investigating",
      })
      .returning()
      .get();
    reportIds[accessType] = report.id;
  }
});

afterAll(async () => {
  await db
    .delete(statusReport)
    .where(eq(statusReport.workspaceId, workspaceId));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.workspaceId, workspaceId));
  await db.delete(page).where(eq(page.workspaceId, workspaceId));
});

const authorized = {
  public: () => caller(),
  password: () =>
    caller({ headers: { cookie: `secured-${slugs.password}=${PASSWORD}` } }),
  "email-domain": () => caller({ email: "jane@ACME.com" }),
  "ip-restriction": () => caller({ headers: { "x-real-ip": "10.1.2.3" } }),
};

const denied = {
  password: () =>
    caller({ headers: { cookie: `secured-${slugs.password}=wrong` } }),
  "email-domain": () => caller({ email: "jane@evil.com" }),
  "ip-restriction": () => caller({ headers: { "x-real-ip": "8.8.8.8" } }),
};

// The reported exploit: anonymous HTTP call with a spoofed `x-trpc-source`.
function httpCall(path: string, input: unknown, headers?: HeadersInit) {
  const url = new URL(`http://status.test/api/trpc/lambda/${path}`);
  url.searchParams.set("input", JSON.stringify({ json: input }));
  const req = new NextRequest(url, {
    headers: { "x-trpc-source": "client", ...headers },
  });
  return fetchRequestHandler({
    endpoint: "/api/trpc/lambda",
    router: appRouter,
    req,
    createContext: () => createTRPCContext({ req }),
  });
}

describe("statusPage over HTTP", () => {
  test("anonymous callers get no protected content by slug", async () => {
    const slug = slugs.password;
    // chrome-only procedures answer 200 with a redacted page, the rest deny
    const calls: [string, unknown, number][] = [
      ["statusPage.get", { slug }, 200],
      ["statusPage.get", { slug: slug.toUpperCase() }, 200],
      ["statusPage.get", { slug, pw: "guess" }, 200],
      ["statusPage.get", { slug, pw: "" }, 200],
      ["statusPage.getLight", { slug }, 200],
      ["statusPage.getGate", { slug }, 200],
      ["statusPage.getReport", { slug, id: reportIds.password }, 401],
      ["statusPage.getMonitors", { slug }, 401],
      ["statusPage.getMonitors", { slug, pw: "guess" }, 401],
      ["statusPage.getUptime", { slug, pageComponentIds: [] }, 401],
    ];
    for (const [path, input, status] of calls) {
      const res = await httpCall(path, input);
      expect(res.status).toBe(status);
      const body = await res.text();
      expect(body).not.toContain("confidential");
      expect(body).not.toContain(PASSWORD);
      expect(body).not.toContain("test-component-");
    }
  });

  test("the right cookie or `pw` still gets the content", async () => {
    const slug = slugs.password;
    const viaCookie = await httpCall(
      "statusPage.getReport",
      { slug, id: reportIds.password },
      { cookie: `secured-${slug}=${PASSWORD}` },
    );
    expect(viaCookie.status).toBe(200);
    expect(await viaCookie.text()).toContain("confidential");
    const viaPw = await httpCall("statusPage.get", { slug, pw: PASSWORD });
    expect(viaPw.status).toBe(200);
    expect(await viaPw.text()).toContain("confidential");
  });
});

describe("statusPage access gate", () => {
  for (const accessType of Object.keys(authorized) as (keyof typeof slugs)[]) {
    test(`${accessType}: authorized caller gets the full page`, async () => {
      const c = authorized[accessType]();
      const slug = slugs[accessType];
      const data = await c.statusPage.get({ slug });
      expect(data?.statusReports.length).toBe(1);
      expect(data?.pageComponents.length).toBe(1);
      const report = await c.statusPage.getReport({
        slug,
        id: reportIds[accessType],
      });
      expect(report?.title).toBe("confidential incident");
    });
  }

  for (const accessType of Object.keys(denied) as (keyof typeof denied)[]) {
    for (const [label, make] of [
      ["anonymous", () => caller()],
      ["wrong credentials", denied[accessType]],
    ] as const) {
      test(`${accessType}: ${label} caller gets chrome only`, async () => {
        const c = make();
        const slug = slugs[accessType];

        for (const data of [
          await c.statusPage.get({ slug }),
          await c.statusPage.getLight({ slug }),
        ]) {
          expect(data?.title).toBe("Test Page");
          expect(data?.accessType).toBe(accessType);
          expect(data?.statusReports).toEqual([]);
          expect(data?.maintenances).toEqual([]);
          expect(data?.pageComponents).toEqual([]);
          expect(data?.monitors).toEqual([]);
          expect(JSON.stringify(data)).not.toContain("confidential");
          expect(JSON.stringify(data)).not.toContain(PASSWORD);
        }

        const attempts = [
          () => c.statusPage.getReport({ slug, id: reportIds[accessType] }),
          () => c.statusPage.getMaintenance({ slug, id: 1 }),
          () => c.statusPage.getMonitors({ slug }),
          () => c.statusPage.getMonitor({ slug, id: 1 }),
          () => c.statusPage.getUptime({ slug, pageComponentIds: [] }),
          () =>
            c.statusPage.subscribe({
              slug,
              email: "outsider@example.com",
              subscribeComponents: false,
              pageComponents: [],
            }),
        ];
        for (const attempt of attempts) {
          const error = await attempt().catch((e) => e);
          expect(error).toBeInstanceOf(TRPCError);
          expect(["UNAUTHORIZED", "FORBIDDEN"]).toContain(
            (error as TRPCError).code,
          );
        }
      });
    }
  }

  for (const accessType of Object.keys(denied) as (keyof typeof denied)[]) {
    test(`${accessType}: pageSubscriber.upsert by page id is gated`, async () => {
      const error = await caller()
        .pageSubscriber.upsert({
          email: "outsider@example.com",
          pageId: pageIds[accessType],
        })
        .catch((e) => e);
      expect(error).toBeInstanceOf(TRPCError);
      expect(["UNAUTHORIZED", "FORBIDDEN"]).toContain(
        (error as TRPCError).code,
      );
    });
  }

  test("password: `pw` input authorizes a cookie-less caller", async () => {
    const data = await caller().statusPage.get({
      slug: slugs.password,
      pw: PASSWORD,
    });
    expect(data?.statusReports.length).toBe(1);
  });

  test("password: a wrong `pw` does not fall through to a valid cookie", async () => {
    const data = await authorized.password().statusPage.get({
      slug: slugs.password,
      pw: "wrong",
    });
    expect(data?.statusReports).toEqual([]);
  });

  test("ip-restriction: spoofed x-forwarded-for loses to x-real-ip", async () => {
    const data = await caller({
      headers: { "x-real-ip": "8.8.8.8", "x-forwarded-for": "10.1.2.3" },
    }).statusPage.get({ slug: slugs["ip-restriction"] });
    expect(data?.statusReports).toEqual([]);
  });
});
