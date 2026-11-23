import { eq } from "@openstatus/db";
import {
  maintenance,
  maintenanceUpdate,
  monitorIncidentTable,
  pageComponentGroup,
  privateLocation,
  privateLocationToMonitors,
  statusReport,
  statusReportUpdate,
  workspace,
} from "@openstatus/db/src/schema";
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
import { ValidationError } from "../../errors";

const UNKNOWN = "public-status-page-no-such-slug";
let workspaceId: number;

beforeAll(async () => {
  workspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

async function addPrivateLocation(tx: DB, monitorIds: number[]) {
  const [location] = await tx
    .insert(privateLocation)
    .values({ name: "pl", token: `t-${crypto.randomUUID()}`, workspaceId })
    .returning();
  for (const monitorId of monitorIds) {
    await tx
      .insert(privateLocationToMonitors)
      .values({ privateLocationId: location.id, monitorId });
  }
}

describe("unknown slugs", () => {
  test("every verb answers null or false", async () => {
    await withTestTransaction(async (tx) => {
      const visitor = {};
      expect(
        await getPublicStatusPage({
          input: { slug: UNKNOWN },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await getPublicStatusPageLight({
          input: { slug: UNKNOWN },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await getPublicStatusPageGate({ input: { slug: UNKNOWN }, db: tx }),
      ).toBeNull();
      expect(
        await getPublicMaintenance({
          input: { slug: UNKNOWN, id: 1 },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await getPublicStatusReport({
          input: { slug: UNKNOWN, id: 1 },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await getPublicStatusPageUptime({
          input: { slug: UNKNOWN, pageComponentIds: [1] },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await listPublicStatusPageMonitors({
          input: { slug: UNKNOWN },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await getPublicStatusPageMonitor({
          input: { slug: UNKNOWN, id: 1 },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await getPublicSubscriptionPage({
          input: { slug: UNKNOWN },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await checkPublicEmailDomain({
          input: { slug: UNKNOWN, email: "a@b.com" },
          db: tx,
        }),
      ).toBeNull();
      expect(
        await verifyPublicStatusPagePassword({
          input: { slug: UNKNOWN, password: "x" },
          db: tx,
        }),
      ).toBeNull();
      expect(
        await isPublicStatusPagePasswordAuthorized({
          input: { slug: UNKNOWN, queryPassword: "x" },
          db: tx,
        }),
      ).toBe(false);
    });
  });
});

describe("slug lookup", () => {
  test("matches the slug case-insensitively", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const result = await getPublicStatusPageLight({
        input: { slug: page.slug.toUpperCase() },
        visitor: {},
        db: tx,
      });
      expect(result?.id).toBe(page.id);
    });
  });

  test("an empty slug never matches a page without a custom domain", async () => {
    await withTestTransaction(async (tx) => {
      await createPage(
        workspaceId,
        { customDomain: "", accessType: "password", password: "" },
        tx,
      );
      const visitor = {};
      expect(
        await getPublicStatusPageGate({ input: { slug: "" }, db: tx }),
      ).toBeNull();
      expect(
        await getPublicStatusPageLight({
          input: { slug: "" },
          visitor,
          db: tx,
        }),
      ).toBeNull();
      expect(
        await isPublicStatusPagePasswordAuthorized({
          input: { slug: "", queryPassword: "" },
          db: tx,
        }),
      ).toBe(false);
    });
  });
});

describe("getPublicStatusPage", () => {
  test("orders components and loads groups, incidents and relations", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const [group] = await tx
        .insert(pageComponentGroup)
        .values({ name: "core", pageId: page.id, workspaceId })
        .returning();
      const monitor = await createMonitor(workspaceId, {}, tx);
      const second = await createPageComponent(
        workspaceId,
        page.id,
        { order: 2, groupId: group.id },
        tx,
      );
      const first = await createPageComponent(
        workspaceId,
        page.id,
        { order: 1, type: "monitor", monitorId: monitor.id },
        tx,
      );
      await tx.insert(monitorIncidentTable).values([
        { monitorId: monitor.id, workspaceId, startedAt: new Date() },
        {
          monitorId: monitor.id,
          workspaceId,
          startedAt: new Date(Date.now() - 7_200_000),
          resolvedAt: new Date(Date.now() - 3_600_000),
          excusedAt: new Date(),
        },
      ]);

      const result = await getPublicStatusPage({
        input: { slug: page.slug },
        visitor: {},
        db: tx,
      });
      const components = result?.page.pageComponents ?? [];
      expect(components.map((c) => c.id)).toEqual([first.id, second.id]);
      expect(components[1]?.group?.id).toBe(group.id);
      // The excused incident is never shown on a public page.
      expect(components[0]?.monitor?.monitorIncidents).toHaveLength(1);
      expect(result?.page.pageComponentGroups.map((g) => g.id)).toEqual([
        group.id,
      ]);
    });
  });

  test("orders report updates and maintenances newest first", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const [report] = await tx
        .insert(statusReport)
        .values({
          title: "r",
          status: "investigating",
          workspaceId,
          pageId: page.id,
        })
        .returning();
      await tx.insert(statusReportUpdate).values([
        {
          statusReportId: report.id,
          status: "investigating",
          message: "old",
          date: new Date("2026-01-01"),
        },
        {
          statusReportId: report.id,
          status: "resolved",
          message: "new",
          date: new Date("2026-01-02"),
        },
      ]);
      const [older, newer] = await tx
        .insert(maintenance)
        .values(
          ["2026-01-01", "2026-02-01"].map((from) => ({
            title: from,
            message: "",
            from: new Date(from),
            to: new Date(new Date(from).getTime() + 3_600_000),
            workspaceId,
            pageId: page.id,
          })),
        )
        .returning();

      const result = await getPublicStatusPage({
        input: { slug: page.slug },
        visitor: {},
        db: tx,
      });
      expect(
        result?.page.statusReports[0]?.statusReportUpdates.map(
          (u) => u.message,
        ),
      ).toEqual(["new", "old"]);
      expect(result?.page.maintenances.map((m) => m.id)).toEqual([
        newer.id,
        older.id,
      ]);
    });
  });

  test("counts private locations per monitor and skips monitors without one", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const [a, b, c] = await Promise.all(
        [0, 1, 2].map(() => createMonitor(workspaceId, {}, tx)),
      );
      for (const m of [a, b, c]) {
        await createPageComponent(
          workspaceId,
          page.id,
          { type: "monitor", monitorId: m.id },
          tx,
        );
      }
      await addPrivateLocation(tx, [a.id, b.id]);
      await addPrivateLocation(tx, [a.id]);

      const result = await getPublicStatusPage({
        input: { slug: page.slug },
        visitor: {},
        db: tx,
      });
      expect(result?.privateLocationCounts.get(a.id)).toBe(2);
      expect(result?.privateLocationCounts.get(b.id)).toBe(1);
      expect(result?.privateLocationCounts.has(c.id)).toBe(false);
    });
  });

  test("a page with only static components has no private location counts", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      await createPageComponent(workspaceId, page.id, {}, tx);
      const result = await getPublicStatusPage({
        input: { slug: page.slug },
        visitor: {},
        db: tx,
      });
      expect(result?.page.pageComponents).toHaveLength(1);
      expect(result?.privateLocationCounts.size).toBe(0);
    });
  });
});

describe("getPublicStatusPageGate", () => {
  test("reports white-label from the workspace limits", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      await tx
        .update(workspace)
        .set({ limits: JSON.stringify({ "white-label": false }) })
        .where(eq(workspace.id, workspaceId));
      const before = await getPublicStatusPageGate({
        input: { slug: page.slug },
        db: tx,
      });
      await tx
        .update(workspace)
        .set({ limits: JSON.stringify({ "white-label": true }) })
        .where(eq(workspace.id, workspaceId));
      const after = await getPublicStatusPageGate({
        input: { slug: page.slug },
        db: tx,
      });
      expect(before?.whiteLabel).toBe(false);
      expect(after?.whiteLabel).toBe(true);
    });
  });

  test("returns only the gate and chrome fields", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(
        workspaceId,
        { allowedIpRanges: "10.0.0.0/8", homepageUrl: "https://acme.com" },
        tx,
      );
      const gate = await getPublicStatusPageGate({
        input: { slug: page.slug },
        db: tx,
      });
      expect(Object.keys(gate ?? {}).sort()).toEqual(
        [
          "accessType",
          "allowedIpRanges",
          "authEmailDomains",
          "contactUrl",
          "customDomain",
          "defaultTimezone",
          "homepageUrl",
          "slug",
          "whiteLabel",
        ].sort(),
      );
      expect(gate?.allowedIpRanges).toEqual(["10.0.0.0/8"]);
      expect(gate?.homepageUrl).toBe("https://acme.com");
    });
  });
});

describe("getPublicMaintenance and getPublicStatusReport", () => {
  test("load updates newest first and the affected components", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const [window] = await tx
        .insert(maintenance)
        .values({
          title: "m",
          message: "",
          from: new Date(),
          to: new Date(Date.now() + 3_600_000),
          workspaceId,
          pageId: page.id,
        })
        .returning();
      await tx.insert(maintenanceUpdate).values([
        { maintenanceId: window.id, message: "first", date: new Date(1_000) },
        { maintenanceId: window.id, message: "second", date: new Date(2_000) },
      ]);

      const result = await getPublicMaintenance({
        input: { slug: page.slug, id: window.id },
        visitor: {},
        db: tx,
      });
      expect(result?.maintenanceUpdates.map((u) => u.message)).toEqual([
        "second",
        "first",
      ]);
    });
  });

  test("an id from another page answers null", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const other = await createPage(workspaceId, {}, tx);
      const [window] = await tx
        .insert(maintenance)
        .values({
          title: "elsewhere",
          message: "",
          from: new Date(),
          to: new Date(Date.now() + 3_600_000),
          workspaceId,
          pageId: other.id,
        })
        .returning();
      expect(
        await getPublicMaintenance({
          input: { slug: page.slug, id: window.id },
          visitor: {},
          db: tx,
        }),
      ).toBeNull();
    });
  });

  test("an unknown id answers null", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      expect(
        await getPublicStatusReport({
          input: { slug: page.slug, id: 999_999_999 },
          visitor: {},
          db: tx,
        }),
      ).toBeNull();
    });
  });
});

describe("getPublicStatusPageUptime", () => {
  test("loads only the requested components of this page", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const other = await createPage(workspaceId, {}, tx);
      const wanted = await createPageComponent(workspaceId, page.id, {}, tx);
      await createPageComponent(workspaceId, page.id, {}, tx);
      const foreign = await createPageComponent(workspaceId, other.id, {}, tx);

      const result = await getPublicStatusPageUptime({
        input: { slug: page.slug, pageComponentIds: [wanted.id, foreign.id] },
        visitor: {},
        db: tx,
      });
      expect(result?.page.pageComponents.map((c) => c.id)).toEqual([wanted.id]);
    });
  });

  test("no requested components still answers with the page", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      await createPageComponent(workspaceId, page.id, {}, tx);
      const result = await getPublicStatusPageUptime({
        input: { slug: page.slug, pageComponentIds: [] },
        visitor: {},
        db: tx,
      });
      expect(result?.page.id).toBe(page.id);
      expect(result?.page.pageComponents).toEqual([]);
    });
  });

  test("marks monitors that have an active private location", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const withLocation = await createMonitor(
        workspaceId,
        { regions: "" },
        tx,
      );
      const without = await createMonitor(workspaceId, { regions: "" }, tx);
      const components = await Promise.all(
        [withLocation, without].map((m) =>
          createPageComponent(
            workspaceId,
            page.id,
            { type: "monitor", monitorId: m.id },
            tx,
          ),
        ),
      );
      await addPrivateLocation(tx, [withLocation.id]);

      const result = await getPublicStatusPageUptime({
        input: {
          slug: page.slug,
          pageComponentIds: components.map((c) => c.id),
        },
        visitor: {},
        db: tx,
      });
      expect(result?.privateLocationCounts.get(withLocation.id)).toBe(1);
      expect(result?.privateLocationCounts.has(without.id)).toBe(false);
    });
  });
});

describe("monitor lists", () => {
  test("listPublicStatusPageMonitors returns every component with its monitor", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const monitor = await createMonitor(workspaceId, { public: false }, tx);
      await createPageComponent(
        workspaceId,
        page.id,
        { type: "monitor", monitorId: monitor.id },
        tx,
      );
      await createPageComponent(workspaceId, page.id, {}, tx);

      const components = await listPublicStatusPageMonitors({
        input: { slug: page.slug },
        visitor: {},
        db: tx,
      });
      // Public filtering is the caller's: the verb returns rows.
      expect(components).toHaveLength(2);
      expect(components?.find((c) => c.monitorId)?.monitor?.public).toBe(false);
    });
  });

  test("getPublicStatusPageMonitor answers [] for a monitor not on the page", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      const elsewhere = await createMonitor(workspaceId, {}, tx);
      expect(
        await getPublicStatusPageMonitor({
          input: { slug: page.slug, id: elsewhere.id },
          visitor: {},
          db: tx,
        }),
      ).toEqual([]);
    });
  });
});

describe("gate verbs", () => {
  test("checkPublicEmailDomain refuses a page that is not email-gated", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, {}, tx);
      await expect(
        checkPublicEmailDomain({
          input: { slug: page.slug, email: "a@acme.com" },
          db: tx,
        }),
      ).rejects.toThrow("not configured to allow email domain");
    });
  });

  test("checkPublicEmailDomain accepts any listed domain, case-insensitively", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(
        workspaceId,
        { accessType: "email-domain", authEmailDomains: "acme.com,beta.io" },
        tx,
      );
      for (const email of ["x@acme.com", "y@BETA.io"]) {
        expect(
          await checkPublicEmailDomain({
            input: { slug: page.slug, email },
            db: tx,
          }),
        ).toEqual({ title: page.title });
      }
      await expect(
        checkPublicEmailDomain({
          input: { slug: page.slug, email: "no-at-sign" },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("verifyPublicStatusPagePassword refuses a page without a password gate", async () => {
    await withTestTransaction(async (tx) => {
      const page = await createPage(workspaceId, { password: "s3cret" }, tx);
      await expect(
        verifyPublicStatusPagePassword({
          input: { slug: page.slug, password: "s3cret" },
          db: tx,
        }),
      ).rejects.toThrow("not configured to allow password");
    });
  });

  test("isPublicStatusPagePasswordAuthorized", async () => {
    await withTestTransaction(async (tx) => {
      const gated = await createPage(
        workspaceId,
        { accessType: "password", password: "s3cret" },
        tx,
      );
      const open = await createPage(workspaceId, { password: "s3cret" }, tx);
      const check = (
        slug: string,
        queryPassword?: string | null,
        cookiePassword?: string | null,
      ) =>
        isPublicStatusPagePasswordAuthorized({
          input: { slug, queryPassword, cookiePassword },
          db: tx,
        });

      expect(await check(gated.slug, "s3cret")).toBe(true);
      expect(await check(gated.slug, undefined, "s3cret")).toBe(true);
      expect(await check(gated.slug)).toBe(false);
      expect(await check(gated.slug, "", "s3cret")).toBe(false);
      expect(await check(gated.slug, "S3CRET")).toBe(false);
      // Only a password-gated page can authorize a password.
      expect(await check(open.slug, "s3cret")).toBe(false);
    });
  });
});
