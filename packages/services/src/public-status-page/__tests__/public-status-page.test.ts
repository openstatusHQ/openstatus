import {
  maintenance,
  privateLocation,
  privateLocationToMonitors,
  statusReport,
} from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import {
  createMonitor,
  createPage,
  createPageComponent,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  checkPublicEmailDomain,
  getPublicMaintenance,
  getPublicStatusPage,
  getPublicStatusPageGate,
  getPublicStatusPageLight,
  getPublicStatusPageMonitor,
  getPublicStatusPageUptime,
  getPublicStatusReport,
  getPublicSubscriptionPage,
  isPublicStatusPagePasswordAuthorized,
  listPublicStatusPageMonitors,
  verifyPublicStatusPagePassword,
} from "..";
import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB } from "../../context";
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../../errors";
import type { PageVisitor } from "../../page-access";

const anonymous: PageVisitor = {};
const withPassword = (pw: string): PageVisitor => ({ queryPassword: pw });

let teamWorkspaceId: number;
let freeWorkspaceId: number;

beforeAll(async () => {
  teamWorkspaceId = (await createWorkspaceFixture("team")).workspace.id;
  freeWorkspaceId = (await createWorkspaceFixture("free")).workspace.id;
});

async function pageWithMonitor(
  tx: DB,
  overrides: Parameters<typeof createPage>[1] = {},
) {
  const page = await createPage(teamWorkspaceId, overrides, tx);
  const monitor = await createMonitor(
    teamWorkspaceId,
    { public: true, regions: "" },
    tx,
  );
  const component = await createPageComponent(
    teamWorkspaceId,
    page.id,
    { type: "monitor", monitorId: monitor.id },
    tx,
  );
  return { page, monitor, component };
}

const passwordPage = { accessType: "password" as const, password: "s3cret" };

describe("getPublicStatusPage", () => {
  test("returns null for an unknown slug", async () => {
    await withTestTransaction(async (tx) => {
      const result = await getPublicStatusPage({
        input: { slug: "no-such-page-public-status" },
        visitor: anonymous,
        db: tx,
      });
      expect(result).toBeNull();
    });
  });

  test("matches the custom domain case-insensitively", async () => {
    await withTestTransaction(async (tx) => {
      const { page } = await pageWithMonitor(tx, {
        customDomain: `Status-${Date.now()}.Example.com`,
      });
      const result = await getPublicStatusPage({
        input: { slug: page.customDomain.toUpperCase() },
        visitor: anonymous,
        db: tx,
      });
      expect(result?.page.id).toBe(page.id);
    });
  });

  test("counts active private locations per monitor", async () => {
    await withTestTransaction(async (tx) => {
      const { page, monitor } = await pageWithMonitor(tx);
      const [location] = await tx
        .insert(privateLocation)
        .values({
          name: "pl",
          token: `t-${Date.now()}`,
          workspaceId: teamWorkspaceId,
        })
        .returning();
      await tx.insert(privateLocationToMonitors).values([
        { privateLocationId: location.id, monitorId: monitor.id },
        {
          privateLocationId: location.id,
          monitorId: monitor.id,
          deletedAt: new Date(),
        },
      ]);

      const result = await getPublicStatusPage({
        input: { slug: page.slug },
        visitor: anonymous,
        db: tx,
      });
      expect(result?.privateLocationCounts.get(monitor.id)).toBe(1);
    });
  });

  test("keeps the chrome but drops content for a denied visitor", async () => {
    await withTestTransaction(async (tx) => {
      const { page } = await pageWithMonitor(tx, passwordPage);

      const denied = await getPublicStatusPage({
        input: { slug: page.slug },
        visitor: anonymous,
        db: tx,
      });
      expect(denied?.page.title).toBe(page.title);
      expect(denied?.page.pageComponents).toEqual([]);

      const allowed = await getPublicStatusPageLight({
        input: { slug: page.slug },
        visitor: withPassword("s3cret"),
        db: tx,
      });
      expect(allowed?.pageComponents).toHaveLength(1);
    });
  });
});

describe("getPublicStatusPageGate", () => {
  test("returns gate fields without the password", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(
        teamWorkspaceId,
        { ...passwordPage, authEmailDomains: "a.com,b.com" },
        tx,
      );
      const gate = await getPublicStatusPageGate({
        input: { slug: page.slug },
        db: tx,
      });
      expect(gate).toMatchObject({
        slug: page.slug,
        accessType: "password",
        authEmailDomains: ["a.com", "b.com"],
      });
      expect(gate).not.toHaveProperty("password");
    });
  });
});

describe("hard-gated reads", () => {
  test("reject a denied visitor and serve an authorized one", async () => {
    await withTestTransaction(async (tx) => {
      const { page, monitor, component } = await pageWithMonitor(
        tx,
        passwordPage,
      );
      const [report] = await tx
        .insert(statusReport)
        .values({
          title: "outage",
          status: "investigating",
          workspaceId: teamWorkspaceId,
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
          workspaceId: teamWorkspaceId,
          pageId: page.id,
        })
        .returning();

      const calls = (visitor: PageVisitor) => [
        getPublicStatusReport({
          input: { slug: page.slug, id: report.id },
          visitor,
          db: tx,
        }),
        getPublicMaintenance({
          input: { slug: page.slug, id: window.id },
          visitor,
          db: tx,
        }),
        getPublicStatusPageUptime({
          input: { slug: page.slug, pageComponentIds: [component.id] },
          visitor,
          db: tx,
        }),
        listPublicStatusPageMonitors({
          input: { slug: page.slug },
          visitor,
          db: tx,
        }),
        getPublicStatusPageMonitor({
          input: { slug: page.slug, id: monitor.id },
          visitor,
          db: tx,
        }),
      ];

      for (const call of calls(anonymous)) {
        await expect(call).rejects.toBeInstanceOf(UnauthorizedError);
      }

      const [r, m, uptime, monitors, single] = await Promise.all(
        calls(withPassword("s3cret")),
      );
      expect(r?.id).toBe(report.id);
      expect(m?.id).toBe(window.id);
      expect(uptime?.page.pageComponents.map((c) => c.id)).toEqual([
        component.id,
      ]);
      expect(monitors).toHaveLength(1);
      expect(single?.[0]?.monitor?.id).toBe(monitor.id);
    });
  });

  test("do not serve a report from another page", async () => {
    await withTestTransaction(async (tx) => {
      const { page } = await pageWithMonitor(tx);
      const other = await createPage(teamWorkspaceId, {}, tx);
      const [report] = await tx
        .insert(statusReport)
        .values({
          title: "elsewhere",
          status: "investigating",
          workspaceId: teamWorkspaceId,
          pageId: other.id,
        })
        .returning();
      const result = await getPublicStatusReport({
        input: { slug: page.slug, id: report.id },
        visitor: anonymous,
        db: tx,
      });
      expect(result).toBeNull();
    });
  });
});

describe("getPublicSubscriptionPage", () => {
  test("returns the page when subscriptions are on the plan", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(teamWorkspaceId, {}, tx);
      expect(
        await getPublicSubscriptionPage({
          input: { slug: page.slug },
          visitor: anonymous,
          db: tx,
        }),
      ).toEqual({ id: page.id });
    });
  });

  test("rejects a plan without status subscribers", async () => {
    expect(getLimits("free")["status-subscribers"]).toBe(false);
    await withTestTransaction(async (tx) => {
      const page = await createPage(freeWorkspaceId, {}, tx);
      await expect(
        getPublicSubscriptionPage({
          input: { slug: page.slug },
          visitor: anonymous,
          db: tx,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("checkPublicEmailDomain", () => {
  test("accepts an allowed domain and rejects others", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(
        teamWorkspaceId,
        { accessType: "email-domain", authEmailDomains: "acme.com" },
        tx,
      );
      expect(
        await checkPublicEmailDomain({
          input: { slug: page.slug, email: "a@acme.com" },
          db: tx,
        }),
      ).toEqual({ title: page.title });
      await expect(
        checkPublicEmailDomain({
          input: { slug: page.slug, email: "a@evil.com" },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

describe("page passwords", () => {
  test("verifyPublicStatusPagePassword checks the stored password", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(teamWorkspaceId, passwordPage, tx);
      expect(
        await verifyPublicStatusPagePassword({
          input: { slug: page.slug, password: "s3cret" },
          db: tx,
        }),
      ).toBe(true);
      await expect(
        verifyPublicStatusPagePassword({
          input: { slug: page.slug, password: "nope" },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("isPublicStatusPagePasswordAuthorized lets a wrong query password win over a valid cookie", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(teamWorkspaceId, passwordPage, tx);
      const check = (queryPassword: string | null, cookiePassword: string) =>
        isPublicStatusPagePasswordAuthorized({
          input: { slug: page.slug, queryPassword, cookiePassword },
          db: tx,
        });
      expect(await check(null, "s3cret")).toBe(true);
      expect(await check("wrong", "s3cret")).toBe(false);
    });
  });
});
