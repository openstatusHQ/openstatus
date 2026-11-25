import { db, eq } from "@openstatus/db";
import {
  maintenance,
  page,
  pageComponent,
  statusReport,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createPage,
  createPageComponent,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { TRPCError } from "@trpc/server";
import { NextRequest } from "next/server.js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { MAX_PAGE_PASSWORD_FAILURES } from "../lib/page-password-rate-limit";
import { appRouter } from "../root";
import { redisKeyCount, resetRedisCounters } from "../test/upstash.mock";
import { createInnerTRPCContext } from "../trpc";

// tRPC codes and messages of the procedures backed by public-status-page verbs.

const PASSWORD = "verbs-pw";
let workspaceId: number;
let freeWorkspaceId: number;
let gated: {
  slug: string;
  reportId: number;
  maintenanceId: number;
  componentId: number;
  monitorId: number;
};
let emailSlug: string;
let publicSlug: string;
let freeSlug: string;

function caller(headers?: Record<string, string>) {
  return appRouter.createCaller(
    createInnerTRPCContext({
      req: new NextRequest("http://rsc.internal", { headers }),
      session: null,
    }),
  ).statusPage;
}

async function trpcError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(TRPCError);
    return err as TRPCError;
  }
  throw new Error("expected a TRPCError");
}

beforeAll(async () => {
  workspaceId = (await createTestWorkspace()).workspace.id;
  freeWorkspaceId = (await createTestWorkspace({ plan: "free" })).workspace.id;

  const gatedPage = await createPage(workspaceId, {
    accessType: "password",
    password: PASSWORD,
  });
  const monitor = await createMonitor(workspaceId, { public: true });
  const component = await createPageComponent(workspaceId, gatedPage.id, {
    type: "monitor",
    monitorId: monitor.id,
  });
  const report = await db
    .insert(statusReport)
    .values({
      workspaceId,
      pageId: gatedPage.id,
      title: "verbs report",
      status: "investigating",
    })
    .returning()
    .get();
  const window = await db
    .insert(maintenance)
    .values({
      workspaceId,
      pageId: gatedPage.id,
      title: "verbs maintenance",
      message: "",
      from: new Date(),
      to: new Date(Date.now() + 3_600_000),
    })
    .returning()
    .get();
  gated = {
    slug: gatedPage.slug,
    reportId: report.id,
    maintenanceId: window.id,
    componentId: component.id,
    monitorId: monitor.id,
  };

  emailSlug = (
    await createPage(workspaceId, {
      accessType: "email-domain",
      authEmailDomains: "acme.com",
    })
  ).slug;
  publicSlug = (await createPage(workspaceId)).slug;
  freeSlug = (await createPage(freeWorkspaceId)).slug;
});

afterAll(async () => {
  for (const id of [workspaceId, freeWorkspaceId]) {
    await db.delete(statusReport).where(eq(statusReport.workspaceId, id));
    await db.delete(maintenance).where(eq(maintenance.workspaceId, id));
    await db.delete(pageComponent).where(eq(pageComponent.workspaceId, id));
    await db.delete(page).where(eq(page.workspaceId, id));
  }
});

describe("hard-gated procedures", () => {
  const calls = (pw?: string) => {
    const sp = caller();
    return {
      getReport: () =>
        sp.getReport({ slug: gated.slug, id: gated.reportId, pw }),
      getMaintenance: () =>
        sp.getMaintenance({ slug: gated.slug, id: gated.maintenanceId, pw }),
      getUptime: () =>
        sp.getUptime({
          slug: gated.slug,
          pw,
          pageComponentIds: [String(gated.componentId)],
          barType: "manual",
        }),
      getMonitors: () => sp.getMonitors({ slug: gated.slug, pw }),
      getMonitor: () =>
        sp.getMonitor({ slug: gated.slug, id: gated.monitorId, pw }),
    };
  };

  test.each([
    "getReport",
    "getMaintenance",
    "getUptime",
    "getMonitors",
    "getMonitor",
  ] as const)("%s answers UNAUTHORIZED without the password", async (name) => {
    const err = await trpcError(calls()[name]());
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Page access denied.");
  });

  test("getReport, getMaintenance and getUptime serve the right password", async () => {
    const c = calls(PASSWORD);
    expect((await c.getReport())?.id).toBe(gated.reportId);
    expect((await c.getMaintenance())?.id).toBe(gated.maintenanceId);
    const uptime = await c.getUptime();
    expect(uptime?.map((u) => u.id)).toEqual([gated.componentId]);
  });

  test("getUptime ignores non-numeric component ids", async () => {
    const uptime = await caller().getUptime({
      slug: gated.slug,
      pw: PASSWORD,
      pageComponentIds: ["not-a-number"],
      barType: "manual",
    });
    expect(uptime).toEqual([]);
  });

  test("an unknown slug answers null, not an error", async () => {
    const sp = caller();
    expect(await sp.getReport({ slug: "verbs-unknown", id: 1 })).toBeNull();
    expect(
      await sp.getMaintenance({ slug: "verbs-unknown", id: 1 }),
    ).toBeNull();
    expect(await sp.getMonitors({ slug: "verbs-unknown" })).toBeNull();
    expect(await sp.getGate({ slug: "verbs-unknown" })).toBeNull();
  });
});

describe("subscribe", () => {
  test("NOT_FOUND for an unknown page", async () => {
    const err = await trpcError(
      caller().subscribe({
        slug: "verbs-unknown",
        email: "a@acme.com",
        subscribeComponents: false,
        pageComponents: [],
      }),
    );
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Page not found");
  });

  test("FORBIDDEN on a plan without status subscribers", async () => {
    const err = await trpcError(
      caller().subscribe({
        slug: freeSlug,
        email: "a@acme.com",
        subscribeComponents: false,
        pageComponents: [],
      }),
    );
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("Upgrade to use status subscribers");
  });

  test("UNAUTHORIZED on a password page without the cookie", async () => {
    const err = await trpcError(
      caller().subscribe({
        slug: gated.slug,
        email: "a@acme.com",
        subscribeComponents: false,
        pageComponents: [],
      }),
    );
    expect(err.code).toBe("UNAUTHORIZED");
  });

  test("BAD_REQUEST for a component of another page", async () => {
    const err = await trpcError(
      caller().subscribe({
        slug: publicSlug,
        email: "a@acme.com",
        subscribeComponents: true,
        pageComponents: [gated.componentId],
      }),
    );
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Some components do not belong to this page");
  });
});

describe("validateEmailDomain", () => {
  test("returns the title and never the raw row", async () => {
    const result = await caller().validateEmailDomain({
      slug: emailSlug,
      email: "jane@acme.com",
    });
    expect(result).toEqual({
      email: "jane@acme.com",
      slug: emailSlug,
      page: { title: expect.any(String) },
    });
  });

  test.each([
    [
      "an unknown page",
      "verbs-unknown",
      "jane@acme.com",
      "NOT_FOUND",
      "Page not found",
    ],
    [
      "a foreign domain",
      null,
      "jane@evil.com",
      "BAD_REQUEST",
      "Invalid email domain",
    ],
  ] as const)("%s", async (_label, slug, email, code, message) => {
    const err = await trpcError(
      caller().validateEmailDomain({ slug: slug ?? emailSlug, email }),
    );
    expect(err.code).toBe(code);
    expect(err.message).toBe(message);
  });

  test("BAD_REQUEST on a page that is not email-gated", async () => {
    const err = await trpcError(
      caller().validateEmailDomain({
        slug: publicSlug,
        email: "jane@acme.com",
      }),
    );
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe(
      "Page is not configured to allow email domain authentication",
    );
  });
});

describe("verifyPassword", () => {
  test("true for the right password", async () => {
    expect(
      await caller().verifyPassword({ slug: gated.slug, password: PASSWORD }),
    ).toBe(true);
  });

  test("BAD_REQUEST for a wrong password", async () => {
    const err = await trpcError(
      caller().verifyPassword({ slug: gated.slug, password: "nope" }),
    );
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Invalid password");
  });

  test("BAD_REQUEST for a page without a password gate", async () => {
    const err = await trpcError(
      caller().verifyPassword({ slug: publicSlug, password: PASSWORD }),
    );
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe(
      "Page is not configured to allow password authentication",
    );
  });

  test("NOT_FOUND for an unknown page", async () => {
    const err = await trpcError(
      caller().verifyPassword({ slug: "verbs-unknown", password: PASSWORD }),
    );
    expect(err.code).toBe("NOT_FOUND");
  });
});

describe("isPasswordAuthorized", () => {
  test("query password, cookie password, and the empty slug", async () => {
    const sp = caller();
    expect(
      await sp.isPasswordAuthorized({
        slug: gated.slug,
        queryPassword: PASSWORD,
      }),
    ).toBe(true);
    expect(
      await sp.isPasswordAuthorized({
        slug: gated.slug,
        cookiePassword: PASSWORD,
      }),
    ).toBe(true);
    expect(
      await sp.isPasswordAuthorized({
        slug: gated.slug,
        queryPassword: "wrong",
        cookiePassword: PASSWORD,
      }),
    ).toBe(false);
    expect(await sp.isPasswordAuthorized({ slug: "", queryPassword: "" })).toBe(
      false,
    );
  });
});

describe("password rate limit", () => {
  beforeEach(() => resetRedisCounters());

  const fromIp = (ip: string) => caller({ "x-real-ip": ip });

  async function failLogins(ip: string, times = MAX_PAGE_PASSWORD_FAILURES) {
    for (let i = 0; i < times; i++) {
      await trpcError(
        fromIp(ip).verifyPassword({ slug: gated.slug, password: `nope-${i}` }),
      );
    }
  }

  test("verifyPassword refuses even the right password once an IP is locked", async () => {
    await failLogins("10.9.0.1");
    const err = await trpcError(
      fromIp("10.9.0.1").verifyPassword({
        slug: gated.slug,
        password: PASSWORD,
      }),
    );
    expect(err.code).toBe("TOO_MANY_REQUESTS");
    expect(err.message).toBe("Too many password attempts. Try again later.");
  });

  test("verifyPassword still accepts the right password below the limit", async () => {
    await failLogins("10.9.0.2", MAX_PAGE_PASSWORD_FAILURES - 1);
    expect(
      await fromIp("10.9.0.2").verifyPassword({
        slug: gated.slug,
        password: PASSWORD,
      }),
    ).toBe(true);
  });

  test("a locked IP does not lock out another IP", async () => {
    await failLogins("10.9.0.3");
    expect(
      await fromIp("10.9.0.4").verifyPassword({
        slug: gated.slug,
        password: PASSWORD,
      }),
    ).toBe(true);
  });

  test("a successful login does not count", async () => {
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES + 1; i++) {
      expect(
        await fromIp("10.9.0.5").verifyPassword({
          slug: gated.slug,
          password: PASSWORD,
        }),
      ).toBe(true);
    }
  });

  test("isPasswordAuthorized answers false once an IP is locked", async () => {
    const sp = fromIp("10.9.0.6");
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) {
      expect(
        await sp.isPasswordAuthorized({
          slug: gated.slug,
          queryPassword: `x-${i}`,
        }),
      ).toBe(false);
    }
    expect(
      await sp.isPasswordAuthorized({
        slug: gated.slug,
        cookiePassword: PASSWORD,
      }),
    ).toBe(false);
  });

  test("isPasswordAuthorized without a password does not count", async () => {
    const sp = fromIp("10.9.0.7");
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES + 1; i++) {
      expect(await sp.isPasswordAuthorized({ slug: gated.slug })).toBe(false);
    }
    expect(
      await sp.isPasswordAuthorized({
        slug: gated.slug,
        cookiePassword: PASSWORD,
      }),
    ).toBe(true);
  });

  test("a parallel burst of wrong logins cannot pass the cap", async () => {
    const sp = fromIp("10.9.1.1");
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) =>
        sp.verifyPassword({ slug: gated.slug, password: `nope-${i}` }),
      ),
    );
    const codes = results.map((r) =>
      r.status === "rejected" ? (r.reason as TRPCError).code : "OK",
    );
    expect(codes.filter((c) => c === "BAD_REQUEST")).toHaveLength(
      MAX_PAGE_PASSWORD_FAILURES,
    );
    expect(codes.filter((c) => c === "TOO_MANY_REQUESTS")).toHaveLength(
      30 - MAX_PAGE_PASSWORD_FAILURES,
    );
  });

  test("unknown pages and pages without a password gate do not count", async () => {
    const sp = fromIp("10.9.1.2");
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES + 1; i++) {
      await trpcError(
        sp.verifyPassword({ slug: "verbs-unknown", password: "x" }),
      );
      await trpcError(sp.verifyPassword({ slug: publicSlug, password: "x" }));
      expect(
        await sp.isPasswordAuthorized({
          slug: `verbs-unknown-${i}`,
          queryPassword: "x",
        }),
      ).toBe(false);
      expect(
        await sp.isPasswordAuthorized({ slug: publicSlug, queryPassword: "x" }),
      ).toBe(false);
    }
    // Neither budget was touched for the gated page or the others.
    expect(
      await sp.verifyPassword({ slug: gated.slug, password: PASSWORD }),
    ).toBe(true);
    expect(redisKeyCount()).toBe(0);
  });

  test("a stale feed cookie does not lock the IP out of logging in", async () => {
    const sp = fromIp("10.9.0.8");
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) {
      await sp.isPasswordAuthorized({
        slug: gated.slug,
        cookiePassword: "old-password",
      });
    }
    expect(
      await sp.verifyPassword({ slug: gated.slug, password: PASSWORD }),
    ).toBe(true);
  });
});

describe("password rate limit across page procedures", () => {
  beforeEach(() => resetRedisCounters());

  const fromIp = (ip: string) => caller({ "x-real-ip": ip });

  async function failReports(ip: string, times = MAX_PAGE_PASSWORD_FAILURES) {
    for (let i = 0; i < times; i++) {
      await trpcError(
        fromIp(ip).getReport({
          slug: gated.slug,
          id: gated.reportId,
          pw: `nope-${i}`,
        }),
      );
    }
  }

  test("wrong guesses on one procedure lock every procedure for that IP", async () => {
    await failReports("10.8.0.1");
    const sp = fromIp("10.8.0.1");
    for (const call of [
      () =>
        sp.getReport({ slug: gated.slug, id: gated.reportId, pw: PASSWORD }),
      () =>
        sp.getMaintenance({
          slug: gated.slug,
          id: gated.maintenanceId,
          pw: PASSWORD,
        }),
      () =>
        sp.getUptime({
          slug: gated.slug,
          pw: PASSWORD,
          pageComponentIds: [String(gated.componentId)],
          barType: "manual",
        }),
      () => sp.getMonitors({ slug: gated.slug, pw: PASSWORD }),
      () =>
        sp.getMonitor({ slug: gated.slug, id: gated.monitorId, pw: PASSWORD }),
    ]) {
      const err = await trpcError(call());
      expect(err.code).toBe("UNAUTHORIZED");
    }
    // get keeps the page frame but drops the content.
    const page = await sp.get({ slug: gated.slug, pw: PASSWORD });
    expect(page?.pageComponents ?? []).toEqual([]);
  });

  test("they share the login form's budget", async () => {
    await failReports("10.8.0.2");
    const err = await trpcError(
      fromIp("10.8.0.2").verifyPassword({
        slug: gated.slug,
        password: PASSWORD,
      }),
    );
    expect(err.code).toBe("TOO_MANY_REQUESTS");
  });

  test("wrong logins lock the page procedures too", async () => {
    const sp = fromIp("10.8.0.3");
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES; i++) {
      await trpcError(
        sp.verifyPassword({ slug: gated.slug, password: `nope-${i}` }),
      );
    }
    const err = await trpcError(
      sp.getReport({ slug: gated.slug, id: gated.reportId, pw: PASSWORD }),
    );
    expect(err.code).toBe("UNAUTHORIZED");
  });

  test("the right password never counts", async () => {
    const sp = fromIp("10.8.0.4");
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES + 2; i++) {
      expect(
        (
          await sp.getReport({
            slug: gated.slug,
            id: gated.reportId,
            pw: PASSWORD,
          })
        )?.id,
      ).toBe(gated.reportId);
    }
  });

  test("a locked IP does not affect another", async () => {
    await failReports("10.8.0.5");
    expect(
      (
        await fromIp("10.8.0.6").getReport({
          slug: gated.slug,
          id: gated.reportId,
          pw: PASSWORD,
        })
      )?.id,
    ).toBe(gated.reportId);
  });

  test("a parallel burst of wrong guesses locks the page", async () => {
    const sp = fromIp("10.8.0.7");
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) =>
        sp.getReport({ slug: gated.slug, id: gated.reportId, pw: `nope-${i}` }),
      ),
    );
    // Wrong and locked both answer 401 here, so the lock shows on the next
    // right password rather than in these codes.
    expect(
      results.every(
        (r) =>
          r.status === "rejected" &&
          (r.reason as TRPCError).code === "UNAUTHORIZED",
      ),
    ).toBe(true);
    const err = await trpcError(
      sp.getReport({ slug: gated.slug, id: gated.reportId, pw: PASSWORD }),
    );
    expect(err.code).toBe("UNAUTHORIZED");
  });

  test("a stale password repeated by every procedure of a render counts once", async () => {
    const sp = fromIp("10.8.0.9");
    for (let i = 0; i < 3; i++) {
      await Promise.allSettled([
        sp.get({ slug: gated.slug, pw: "old-password" }),
        sp.getReport({
          slug: gated.slug,
          id: gated.reportId,
          pw: "old-password",
        }),
        sp.getMonitors({ slug: gated.slug, pw: "old-password" }),
        sp.getMonitor({
          slug: gated.slug,
          id: gated.monitorId,
          pw: "old-password",
        }),
        sp.getUptime({
          slug: gated.slug,
          pw: "old-password",
          pageComponentIds: [String(gated.componentId)],
          barType: "manual",
        }),
      ]);
    }
    expect(
      (
        await sp.getReport({
          slug: gated.slug,
          id: gated.reportId,
          pw: PASSWORD,
        })
      )?.id,
    ).toBe(gated.reportId);
  });

  test("many concurrent visitors with the right password never lock each other out", async () => {
    const sp = fromIp("10.8.0.10");
    const reports = await Promise.all(
      Array.from({ length: MAX_PAGE_PASSWORD_FAILURES * 5 }, () =>
        sp.getReport({ slug: gated.slug, id: gated.reportId, pw: PASSWORD }),
      ),
    );
    expect(reports.every((r) => r?.id === gated.reportId)).toBe(true);
  });

  test("requests without a password do not count", async () => {
    const sp = fromIp("10.8.0.8");
    for (let i = 0; i < MAX_PAGE_PASSWORD_FAILURES + 2; i++) {
      await trpcError(sp.getReport({ slug: gated.slug, id: gated.reportId }));
    }
    expect(
      (
        await sp.getReport({
          slug: gated.slug,
          id: gated.reportId,
          pw: PASSWORD,
        })
      )?.id,
    ).toBe(gated.reportId);
  });
});
