import { eq } from "@openstatus/db";
import {
  monitor,
  notification,
  page,
  pageComponent,
  selectWorkspaceSchema,
  statusReport,
  workspace,
} from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeSystemCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import { ForbiddenError } from "../../errors";
import {
  getWorkspace,
  getWorkspaceByStripeId,
  getWorkspaceWithUsage,
  listWorkspaces,
  updateWorkspaceName,
  updateWorkspacePlan,
} from "../index.ts";

let teamCtx: ServiceContext;
let teamUserId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  teamUserId = team.userId;
  teamCtx = makeUserCtx(team.workspace, { userId: teamUserId });
});

describe("getWorkspace", () => {
  test("returns the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const result = await getWorkspace({ ctx: { ...teamCtx, db: tx } });
      expect(result.id).toBe(teamCtx.workspace.id);
      expect(typeof result.limits).toBe("object");
    });
  });
});

describe("getWorkspaceWithUsage", () => {
  test("attaches a zero-or-positive usage block", async () => {
    await withTestTransaction(async (tx) => {
      const result = await getWorkspaceWithUsage({
        ctx: { ...teamCtx, db: tx },
      });
      expect(result.id).toBe(teamCtx.workspace.id);

      // Iterate the usage object *before* any `toMatchObject` call —
      // the `toMatchObject` implementation mutates the received
      // object in place, replacing number fields with the
      // `expect.any(Number)` asymmetric-matcher stub on the expected
      // side. Subsequent reads of `result.usage.<key>` then return the
      // matcher object (typeof "object"), not the original count. Do
      // the value-shape + non-negative check first.
      for (const key of [
        "monitors",
        "notifications",
        "pages",
        "pageComponents",
        "statusReports",
        "checks",
      ] as const) {
        const value = result.usage[key];
        expect(typeof value).toBe("number");
        if (typeof value === "number") {
          expect(value).toBeGreaterThanOrEqual(0);
        }
      }
      expect(result.usage.checks).toBe(0);
    });
  });

  test("counts workspace-scoped status reports", async () => {
    await withTestTransaction(async (tx) => {
      await tx.insert(statusReport).values({
        workspaceId: teamCtx.workspace.id,
        status: "investigating",
        title: "svc-ws-test-status-report",
      });
      const result = await getWorkspaceWithUsage({
        ctx: { ...teamCtx, db: tx },
      });
      expect(result.usage.statusReports).toBeGreaterThanOrEqual(1);
    });
  });

  // The usage block is six independent counts rather than a relational read;
  // each one must move by exactly the number of rows inserted.
  test("each count moves by exactly the rows added", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const workspaceId = teamCtx.workspace.id;
      const before = (await getWorkspaceWithUsage({ ctx })).usage;

      await tx.insert(monitor).values([
        { workspaceId, url: "https://a.example.dev", name: "svc-ws-usage-1" },
        { workspaceId, url: "https://b.example.dev", name: "svc-ws-usage-2" },
      ]);
      await tx.insert(notification).values({
        workspaceId,
        name: "svc-ws-usage-notif",
        provider: "email",
        data: JSON.stringify({ email: "usage@openstatus.dev" }),
      });
      const [pageRow] = await tx
        .insert(page)
        .values({
          workspaceId,
          title: "svc-ws-usage-page",
          description: "",
          slug: `svc-ws-usage-${workspaceId}`,
          customDomain: "",
        })
        .returning();
      if (!pageRow) throw new Error("page insert returned no row");
      await tx.insert(pageComponent).values([
        {
          workspaceId,
          pageId: pageRow.id,
          type: "static",
          name: "svc-ws-usage-c1",
          order: 0,
        },
        {
          workspaceId,
          pageId: pageRow.id,
          type: "static",
          name: "svc-ws-usage-c2",
          order: 1,
        },
      ]);
      await tx.insert(statusReport).values({
        workspaceId,
        status: "investigating",
        title: "svc-ws-usage-report",
      });

      const after = (await getWorkspaceWithUsage({ ctx })).usage;
      expect(after.monitors).toBe(before.monitors + 2);
      expect(after.notifications).toBe(before.notifications + 1);
      expect(after.pages).toBe(before.pages + 1);
      expect(after.pageComponents).toBe(before.pageComponents + 2);
      expect(after.statusReports).toBe(before.statusReports + 1);
      expect(after.checks).toBe(0);
    });
  });

  test("excludes soft-deleted monitors from the monitor count", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const workspaceId = teamCtx.workspace.id;
      const before = (await getWorkspaceWithUsage({ ctx })).usage.monitors;

      await tx.insert(monitor).values({
        workspaceId,
        url: "https://deleted.example.dev",
        name: "svc-ws-usage-deleted",
        deletedAt: new Date(),
      });

      const after = (await getWorkspaceWithUsage({ ctx })).usage.monitors;
      expect(after).toBe(before);
    });
  });

  test("does not count another workspace's rows", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const before = (await getWorkspaceWithUsage({ ctx })).usage;

      const [foreign] = await tx
        .insert(workspace)
        .values({
          slug: `svc-ws-usage-foreign-${teamCtx.workspace.id}`,
          name: "Foreign",
          stripeId: `svc-ws-usage-stripe-${teamCtx.workspace.id}`,
          plan: "team",
        })
        .returning();
      if (!foreign) throw new Error("workspace insert returned no row");
      await tx.insert(monitor).values({
        workspaceId: foreign.id,
        url: "https://foreign.example.dev",
        name: "svc-ws-usage-foreign-monitor",
      });
      await tx.insert(statusReport).values({
        workspaceId: foreign.id,
        status: "investigating",
        title: "svc-ws-usage-foreign-report",
      });

      const after = (await getWorkspaceWithUsage({ ctx })).usage;
      expect(after.monitors).toBe(before.monitors);
      expect(after.statusReports).toBe(before.statusReports);
    });
  });
});

describe("listWorkspaces", () => {
  test("returns every workspace a user belongs to", async () => {
    await withTestTransaction(async (tx) => {
      const rows = await listWorkspaces({
        ctx: { ...teamCtx, db: tx },
        input: { userId: teamUserId },
      });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(teamCtx.workspace.id);
    });
  });

  test("returns an empty list for a user with no memberships", async () => {
    await withTestTransaction(async (tx) => {
      const rows = await listWorkspaces({
        ctx: { ...teamCtx, db: tx },
        input: { userId: 999_999 },
      });
      expect(rows).toEqual([]);
    });
  });
});

describe("updateWorkspaceName", () => {
  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        updateWorkspaceName({
          ctx: readOnlyCtx,
          input: { name: "blocked" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("renames the workspace and emits an audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const nextName = `svc-ws-test-${Date.now()}`;
      await updateWorkspaceName({
        ctx,
        input: { name: nextName },
      });

      const row = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, teamCtx.workspace.id))
        .get();
      expect(row?.name).toBe(nextName);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "workspace.update",
        entityType: "workspace",
        entityId: teamCtx.workspace.id,
        actorType: "user",
        db: tx,
      });
    });
  });
});

describe("getWorkspaceByStripeId", () => {
  test("resolves the workspace for a known stripe customer id", async () => {
    await withTestTransaction(async (tx) => {
      const inserted = await tx
        .insert(workspace)
        .values({
          slug: "svc-ws-by-stripe",
          name: "Stripe Lookup",
          plan: "team",
          stripeId: "cus_svc_ws_by_stripe",
          limits: JSON.stringify(getLimits("team")),
        })
        .returning()
        .get();

      const result = await getWorkspaceByStripeId({
        input: { stripeId: "cus_svc_ws_by_stripe" },
        db: tx,
      });
      expect(result?.id).toBe(inserted.id);
      expect(typeof result?.limits).toBe("object");
    });
  });

  test("returns null when no workspace maps to the customer", async () => {
    await withTestTransaction(async (tx) => {
      const result = await getWorkspaceByStripeId({
        input: { stripeId: "cus_does_not_exist" },
        db: tx,
      });
      expect(result).toBeNull();
    });
  });
});

async function insertPlanWorkspace(
  tx: DrizzleTx,
  opts: { plan: "free" | "starter" | "team" | "scale"; slug: string },
) {
  const row = await tx
    .insert(workspace)
    .values({
      slug: opts.slug,
      name: opts.slug,
      plan: opts.plan,
      stripeId: `cus_${opts.slug}`,
      subscriptionId: `sub_${opts.slug}`,
      limits: JSON.stringify(getLimits(opts.plan)),
    })
    .returning()
    .get();
  return selectWorkspaceSchema.parse(row);
}

describe("updateWorkspacePlan", () => {
  test("writes the new plan + limits and audits the change", async () => {
    await withTestTransaction(async (tx) => {
      const ws = await insertPlanWorkspace(tx, {
        plan: "team",
        slug: "svc-plan-downgrade",
      });
      const ctx = {
        ...makeSystemCtx(ws, { job: "stripe-subscription-updated" }),
        db: tx,
      };

      await updateWorkspacePlan({
        ctx,
        input: {
          plan: "starter",
          subscriptionId: "sub_new",
          paidUntil: new Date("2027-01-01T00:00:00Z"),
          endsAt: new Date("2027-01-01T00:00:00Z"),
          limits: getLimits("starter"),
        },
      });

      const after = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, ws.id))
        .get();
      expect(after?.plan).toBe("starter");
      expect(after?.subscriptionId).toBe("sub_new");
      // Compare parsed content, not the raw string — the verb persists
      // `limitsSchema`-canonicalised JSON (key order differs from the
      // config object returned by `getLimits`).
      expect(JSON.parse(after?.limits ?? "{}")).toEqual(getLimits("starter"));

      await expectAuditRow({
        workspaceId: ws.id,
        action: "workspace.update",
        entityType: "workspace",
        entityId: ws.id,
        actorType: "system",
        db: tx,
      });

      const [audit] = await readAuditLog({
        workspaceId: ws.id,
        entityType: "workspace",
        entityId: ws.id,
        db: tx,
      });
      expect(audit?.changedFields).toContain("plan");
      // No `reason` passed → no metadata stamped.
      expect(audit?.metadata).toBeNull();
    });
  });

  test("stamps reason / from / to metadata when a reason is given", async () => {
    await withTestTransaction(async (tx) => {
      const ws = await insertPlanWorkspace(tx, {
        plan: "free",
        slug: "svc-plan-checkout",
      });
      const ctx = {
        ...makeSystemCtx(ws, { job: "stripe-session-completed" }),
        db: tx,
      };

      await updateWorkspacePlan({
        ctx,
        input: {
          plan: "team",
          subscriptionId: "sub_checkout",
          paidUntil: new Date("2027-01-01T00:00:00Z"),
          endsAt: new Date("2027-01-01T00:00:00Z"),
          limits: getLimits("team"),
          reason: "checkout_session_completed",
        },
      });

      const [audit] = await readAuditLog({
        workspaceId: ws.id,
        entityType: "workspace",
        entityId: ws.id,
        db: tx,
      });
      expect(audit?.metadata).toMatchObject({
        reason: "checkout_session_completed",
        from: "free",
        to: "team",
      });
    });
  });

  test("rejects a read-only api key actor", async () => {
    await withTestTransaction(async (tx) => {
      const ws = await insertPlanWorkspace(tx, {
        plan: "team",
        slug: "svc-plan-readonly",
      });
      const ctx = {
        ...makeApiKeyCtx(ws, { keyId: "k-read", userId: 1, scopes: ["read"] }),
        db: tx,
      };

      await expect(
        updateWorkspacePlan({
          ctx,
          input: {
            plan: "starter",
            subscriptionId: null,
            paidUntil: null,
            endsAt: null,
            limits: getLimits("starter"),
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
