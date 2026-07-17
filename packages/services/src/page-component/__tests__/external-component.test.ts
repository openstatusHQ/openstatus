import { and, eq } from "@openstatus/db";
import {
  externalService,
  externalServiceComponent,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx } from "../../context";
import type { ServiceContext } from "../../context";
import { ForbiddenError, ValidationError } from "../../errors";
import { updatePageComponentOrder } from "../update-order";

const TEST_PREFIX = "svc-external-cmp-test";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
});

async function setup(tx: DrizzleTx) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const pageRow = await tx
    .insert(page)
    .values({
      workspaceId: teamCtx.workspace.id,
      title: `${TEST_PREFIX}-page`,
      description: "test",
      slug: `${TEST_PREFIX}-${suffix}`,
      customDomain: "",
    })
    .returning()
    .get();

  const svc = await tx
    .insert(externalService)
    .values({
      slug: `${TEST_PREFIX}-svc-${suffix}`,
      name: "Test Provider",
      url: "https://example.com",
      statusPageUrl: "https://example.com/status",
      provider: "atlassian-statuspage",
      industry: ["saas"],
    })
    .returning()
    .get();

  const cmp = await tx
    .insert(externalServiceComponent)
    .values({
      externalServiceId: svc.id,
      upstreamComponentId: `u-${suffix}`,
      slug: `comp-${suffix}`,
      name: "Edge Network",
      indicator: "none",
      status: "operational",
    })
    .returning()
    .get();

  return { pageId: pageRow.id, serviceId: svc.id, componentId: cmp.id };
}

describe("updatePageComponentOrder — external components", () => {
  test("creates whole-service and component-level external rows", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, serviceId, componentId } = await setup(tx);

      await updatePageComponentOrder({
        ctx,
        input: {
          pageId,
          components: [
            {
              order: 0,
              name: "Test Provider",
              type: "external",
              externalServiceId: serviceId,
            },
            {
              order: 1,
              name: "Edge Network",
              type: "external",
              externalServiceId: serviceId,
              externalServiceComponentId: componentId,
            },
          ],
          groups: [],
        },
      });

      const rows = await tx
        .select()
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, pageId),
            eq(pageComponent.type, "external"),
          ),
        )
        .all();

      expect(rows).toHaveLength(2);
      const whole = rows.find((r) => r.externalServiceComponentId == null);
      const specific = rows.find((r) => r.externalServiceComponentId != null);
      expect(whole?.externalServiceId).toBe(serviceId);
      expect(whole?.monitorId).toBeNull();
      expect(specific?.externalServiceComponentId).toBe(componentId);

      if (!whole) throw new Error("unreachable");
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "page_component.create",
        entityType: "page_component",
        entityId: whole.id,
        db: tx,
      });
    });
  });

  test("rejects an unknown external service id", async () => {
    await withTestTransaction(async (tx) => {
      const { pageId } = await setup(tx);
      await expect(
        updatePageComponentOrder({
          ctx: { ...teamCtx, db: tx },
          input: {
            pageId,
            components: [
              {
                order: 0,
                name: "Ghost",
                type: "external",
                externalServiceId: 999_999_999,
              },
            ],
            groups: [],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("rejects a component that belongs to another service", async () => {
    await withTestTransaction(async (tx) => {
      const { pageId, componentId } = await setup(tx);
      const other = await tx
        .insert(externalService)
        .values({
          slug: `${TEST_PREFIX}-other-${crypto.randomUUID().slice(0, 8)}`,
          name: "Other",
          url: "https://other.example.com",
          statusPageUrl: "https://other.example.com/status",
          provider: "atlassian-statuspage",
          industry: ["saas"],
        })
        .returning()
        .get();

      await expect(
        updatePageComponentOrder({
          ctx: { ...teamCtx, db: tx },
          input: {
            pageId,
            components: [
              {
                order: 0,
                name: "Mismatched",
                type: "external",
                externalServiceId: other.id,
                externalServiceComponentId: componentId,
              },
            ],
            groups: [],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("rejects a static component carrying an external component id", async () => {
    await withTestTransaction(async (tx) => {
      const { pageId } = await setup(tx);
      await expect(
        updatePageComponentOrder({
          ctx: { ...teamCtx, db: tx },
          input: {
            pageId,
            components: [
              {
                order: 0,
                name: "Mixed",
                type: "static",
                externalServiceComponentId: 1,
              },
            ],
            groups: [],
          },
        }),
      ).rejects.toThrow();
    });
  });

  test("rejects adding a new ref to a soft-deleted service", async () => {
    await withTestTransaction(async (tx) => {
      const { pageId } = await setup(tx);
      const deleted = await tx
        .insert(externalService)
        .values({
          slug: `${TEST_PREFIX}-deleted-${crypto.randomUUID().slice(0, 8)}`,
          name: "Deleted",
          url: "https://deleted.example.com",
          statusPageUrl: "https://deleted.example.com/status",
          provider: "atlassian-statuspage",
          industry: ["saas"],
          deletedAt: new Date(),
        })
        .returning()
        .get();

      await expect(
        updatePageComponentOrder({
          ctx: { ...teamCtx, db: tx },
          input: {
            pageId,
            components: [
              {
                order: 0,
                name: "Dead",
                type: "external",
                externalServiceId: deleted.id,
              },
            ],
            groups: [],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("allows re-saving an existing ref whose service was soft-deleted", async () => {
    await withTestTransaction(async (tx) => {
      const { pageId, serviceId } = await setup(tx);
      const existing = await tx
        .insert(pageComponent)
        .values({
          workspaceId: teamCtx.workspace.id,
          pageId,
          type: "external",
          name: "Provider",
          order: 0,
          externalServiceId: serviceId,
        })
        .returning()
        .get();

      await tx
        .update(externalService)
        .set({ deletedAt: new Date() })
        .where(eq(externalService.id, serviceId));

      await updatePageComponentOrder({
        ctx: { ...teamCtx, db: tx },
        input: {
          pageId,
          components: [
            {
              id: existing.id,
              order: 0,
              name: "Provider",
              type: "external",
              externalServiceId: serviceId,
            },
          ],
          groups: [],
        },
      });

      const rows = await tx
        .select()
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, pageId),
            eq(pageComponent.type, "external"),
          ),
        )
        .all();
      expect(rows).toHaveLength(1);
    });
  });

  test("rejects duplicate external refs in one payload", async () => {
    await withTestTransaction(async (tx) => {
      const { pageId, serviceId } = await setup(tx);
      await expect(
        updatePageComponentOrder({
          ctx: { ...teamCtx, db: tx },
          input: {
            pageId,
            components: [
              {
                order: 0,
                name: "A",
                type: "external",
                externalServiceId: serviceId,
              },
              {
                order: 1,
                name: "B",
                type: "external",
                externalServiceId: serviceId,
              },
            ],
            groups: [],
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

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
        updatePageComponentOrder({
          ctx: readOnlyCtx,
          input: { pageId: 1, components: [], groups: [] },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
