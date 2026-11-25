import { maintenance, statusReport } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createPage,
  createPageComponent,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  getPublicMaintenance,
  getPublicStatusPage,
  getPublicStatusPageLight,
  getPublicStatusPageMonitor,
  getPublicStatusPageUptime,
  getPublicStatusReport,
  getPublicSubscriptionPage,
  listPublicStatusPageMonitors,
} from "..";
import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB } from "../../context";
import { ForbiddenError, UnauthorizedError } from "../../errors";
import {
  type PageVisitor,
  type PasswordAttemptLimiter,
  pageAccessCookieKey,
} from "../../page-access";
import {
  hasPendingSubscriber,
  upsertSelfSignupSubscriber,
} from "../../page-subscriber";

let workspaceId: number;

beforeAll(async () => {
  workspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

type PageOverrides = NonNullable<Parameters<typeof createPage>[1]>;

/** A page with one monitor component, one report and one maintenance. */
async function gatedPage(tx: DB, overrides: PageOverrides) {
  const page = await createPage(workspaceId, overrides, tx);
  const monitor = await createMonitor(workspaceId, { public: true }, tx);
  const component = await createPageComponent(
    workspaceId,
    page.id,
    { type: "monitor", monitorId: monitor.id },
    tx,
  );
  const [report] = await tx
    .insert(statusReport)
    .values({
      title: "outage",
      status: "investigating",
      workspaceId,
      pageId: page.id,
    })
    .returning();
  const [window] = await tx
    .insert(maintenance)
    .values({
      title: "upgrade",
      message: "",
      from: new Date(),
      to: new Date(Date.now() + 3_600_000),
      workspaceId,
      pageId: page.id,
    })
    .returning();
  return { page, monitor, component, report, window };
}

/** Every verb that throws for a denied visitor, against one page. */
function hardGated(
  tx: DB,
  p: Awaited<ReturnType<typeof gatedPage>>,
  visitor: PageVisitor,
) {
  const slug = p.page.slug;
  return {
    report: () =>
      getPublicStatusReport({
        input: { slug, id: p.report.id },
        visitor,
        db: tx,
      }),
    maintenance: () =>
      getPublicMaintenance({
        input: { slug, id: p.window.id },
        visitor,
        db: tx,
      }),
    uptime: () =>
      getPublicStatusPageUptime({
        input: { slug, pageComponentIds: [p.component.id] },
        visitor,
        db: tx,
      }),
    monitors: () =>
      listPublicStatusPageMonitors({ input: { slug }, visitor, db: tx }),
    monitor: () =>
      getPublicStatusPageMonitor({
        input: { slug, id: p.monitor.id },
        visitor,
        db: tx,
      }),
    subscription: () =>
      getPublicSubscriptionPage({ input: { slug }, visitor, db: tx }),
  };
}

const MODES: {
  name: string;
  page: PageOverrides;
  allowed: (slug: string) => PageVisitor;
  denied: PageVisitor;
  deniedError: typeof UnauthorizedError | typeof ForbiddenError;
}[] = [
  {
    name: "password via query",
    page: { accessType: "password", password: "s3cret" },
    allowed: () => ({ queryPassword: "s3cret" }),
    denied: { queryPassword: "wrong" },
    deniedError: UnauthorizedError,
  },
  {
    name: "password via cookie",
    page: { accessType: "password", password: "s3cret" },
    allowed: (slug) => ({
      getCookie: (name) =>
        name === pageAccessCookieKey(slug) ? "s3cret" : undefined,
    }),
    denied: { getCookie: () => "wrong" },
    deniedError: UnauthorizedError,
  },
  {
    name: "email domain",
    page: { accessType: "email-domain", authEmailDomains: "acme.com" },
    allowed: () => ({ email: "ops@ACME.com" }),
    denied: { email: "ops@evil.com" },
    deniedError: ForbiddenError,
  },
  {
    name: "ip restriction",
    page: { accessType: "ip-restriction", allowedIpRanges: "10.0.0.0/8" },
    allowed: () => ({ clientIp: "10.1.2.3" }),
    denied: { clientIp: "192.168.1.1" },
    deniedError: ForbiddenError,
  },
];

describe.each(MODES)("$name", (mode) => {
  test("hard-gated verbs refuse a denied visitor", async () => {
    await withTestTransaction(async (tx) => {
      const p = await gatedPage(tx, mode.page);
      for (const call of Object.values(hardGated(tx, p, mode.denied))) {
        await expect(call()).rejects.toBeInstanceOf(mode.deniedError);
      }
    });
  });

  test("hard-gated verbs refuse an anonymous visitor", async () => {
    await withTestTransaction(async (tx) => {
      const p = await gatedPage(tx, mode.page);
      for (const call of Object.values(hardGated(tx, p, {}))) {
        await expect(call()).rejects.toBeInstanceOf(mode.deniedError);
      }
    });
  });

  test("hard-gated verbs serve an allowed visitor", async () => {
    await withTestTransaction(async (tx) => {
      const p = await gatedPage(tx, mode.page);
      const calls = hardGated(tx, p, mode.allowed(p.page.slug));
      expect((await calls.report())?.id).toBe(p.report.id);
      expect((await calls.maintenance())?.id).toBe(p.window.id);
      expect((await calls.uptime())?.page.pageComponents).toHaveLength(1);
      expect(await calls.monitors()).toHaveLength(1);
      expect(await calls.monitor()).toHaveLength(1);
      expect(await calls.subscription()).toEqual({ id: p.page.id });
    });
  });

  test("get and getLight hide content from a denied visitor", async () => {
    await withTestTransaction(async (tx) => {
      const p = await gatedPage(tx, mode.page);
      const full = await getPublicStatusPage({
        input: { slug: p.page.slug },
        visitor: mode.denied,
        db: tx,
      });
      const light = await getPublicStatusPageLight({
        input: { slug: p.page.slug },
        visitor: mode.denied,
        db: tx,
      });
      for (const page of [full?.page, light]) {
        expect(page).toMatchObject({
          id: p.page.id,
          title: p.page.title,
          statusReports: [],
          maintenances: [],
          pageComponents: [],
          pageComponentGroups: [],
        });
        expect(page?.workspace.id).toBe(workspaceId);
      }
      expect(full?.privateLocationCounts.size).toBe(0);
    });
  });

  test("get and getLight show content to an allowed visitor", async () => {
    await withTestTransaction(async (tx) => {
      const p = await gatedPage(tx, mode.page);
      const visitor = mode.allowed(p.page.slug);
      const full = await getPublicStatusPage({
        input: { slug: p.page.slug },
        visitor,
        db: tx,
      });
      const light = await getPublicStatusPageLight({
        input: { slug: p.page.slug },
        visitor,
        db: tx,
      });
      for (const page of [full?.page, light]) {
        expect(page?.pageComponents.map((c) => c.id)).toEqual([p.component.id]);
        expect(page?.statusReports.map((r) => r.id)).toEqual([p.report.id]);
        expect(page?.maintenances.map((m) => m.id)).toEqual([p.window.id]);
      }
    });
  });
});

describe("public page", () => {
  test("every verb serves an anonymous visitor", async () => {
    await withTestTransaction(async (tx) => {
      const p = await gatedPage(tx, { accessType: "public" });
      const calls = hardGated(tx, p, {});
      for (const call of Object.values(calls)) {
        await expect(call()).resolves.not.toBeNull();
      }
      const full = await getPublicStatusPage({
        input: { slug: p.page.slug },
        visitor: {},
        db: tx,
      });
      expect(full?.page.pageComponents).toHaveLength(1);
    });
  });
});

describe("password rate limit", () => {
  const lockedLimiter: PasswordAttemptLimiter = {
    isLocked: async () => true,
    recordFailure: async () => {},
  };

  function countingLimiter() {
    const counts = { isLocked: 0, recordFailure: 0 };
    const limiter: PasswordAttemptLimiter = {
      isLocked: async () => {
        counts.isLocked++;
        return false;
      },
      recordFailure: async () => {
        counts.recordFailure++;
      },
    };
    return { limiter, counts };
  }

  const passwordGate = { accessType: "password" as const, password: "s3cret" };

  test("a locked visitor is refused the right password by every verb", async () => {
    await withTestTransaction(async (tx) => {
      const p = await gatedPage(tx, passwordGate);
      const visitor: PageVisitor = {
        queryPassword: "s3cret",
        passwordAttempts: lockedLimiter,
      };
      for (const call of Object.values(hardGated(tx, p, visitor))) {
        await expect(call()).rejects.toBeInstanceOf(UnauthorizedError);
      }
      await expect(
        upsertSelfSignupSubscriber({
          input: { email: "a@acme.com", pageId: p.page.id },
          visitor,
          db: tx,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(
        hasPendingSubscriber({
          input: { email: "a@acme.com", pageId: p.page.id },
          visitor,
          db: tx,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);

      const full = await getPublicStatusPage({
        input: { slug: p.page.slug },
        visitor,
        db: tx,
      });
      expect(full?.page.title).toBe(p.page.title);
      expect(full?.page.pageComponents).toEqual([]);
    });
  });

  test("the right password only reads the lock; a wrong one is recorded", async () => {
    await withTestTransaction(async (tx) => {
      const p = await gatedPage(tx, passwordGate);
      const right = countingLimiter();
      await getPublicStatusReport({
        input: { slug: p.page.slug, id: p.report.id },
        visitor: { queryPassword: "s3cret", passwordAttempts: right.limiter },
        db: tx,
      });
      expect(right.counts).toEqual({ isLocked: 1, recordFailure: 0 });

      const wrong = countingLimiter();
      await expect(
        getPublicStatusReport({
          input: { slug: p.page.slug, id: p.report.id },
          visitor: { queryPassword: "nope", passwordAttempts: wrong.limiter },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(wrong.counts).toEqual({ isLocked: 0, recordFailure: 1 });
    });
  });

  test("public pages and other gates never touch the limiter", async () => {
    await withTestTransaction(async (tx) => {
      for (const gate of [
        { accessType: "public" as const },
        {
          accessType: "ip-restriction" as const,
          allowedIpRanges: "10.0.0.0/8",
        },
      ]) {
        const p = await gatedPage(tx, gate);
        const { limiter, counts } = countingLimiter();
        const visitor: PageVisitor = {
          clientIp: "10.1.2.3",
          queryPassword: "anything",
          passwordAttempts: limiter,
        };
        for (const call of Object.values(hardGated(tx, p, visitor))) {
          await call();
        }
        expect(counts).toEqual({ isLocked: 0, recordFailure: 0 });
      }
    });
  });
});
