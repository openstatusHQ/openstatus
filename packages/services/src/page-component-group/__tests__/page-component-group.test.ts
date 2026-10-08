import { db, eq } from "@openstatus/db";
import { page, pageComponentGroup } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { createPageComponentGroup } from "../create";
import { deletePageComponentGroup } from "../delete";
import { updatePageComponentGroup } from "../update";

const TEST_PREFIX = "svc-page-component-group-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let testPageId: number;

function readOnlyCtx(ctx: ServiceContext, tx: ServiceContext["db"]) {
  return {
    ...makeApiKeyCtx(ctx.workspace, {
      keyId: "k-read",
      userId: 1,
      scopes: ["read"],
    }),
    db: tx,
  };
}

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  const free = (await createWorkspaceFixture("free")).workspace;
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

  const pageRow = await db
    .insert(page)
    .values({
      workspaceId: team.id,
      title: `${TEST_PREFIX}-page`,
      description: "test",
      slug: `${TEST_PREFIX}-slug`,
      customDomain: "",
    })
    .returning()
    .get();
  testPageId = pageRow.id;
});

afterAll(async () => {
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.pageId, testPageId))
    .catch(() => undefined);
  await db
    .delete(page)
    .where(eq(page.id, testPageId))
    .catch(() => undefined);
});

describe("createPageComponentGroup", () => {
  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createPageComponentGroup({
          ctx: readOnlyCtx(teamCtx, tx),
          input: { pageId: testPageId, name: "nope", defaultOpen: false },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("creates a group and emits an audit row", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createPageComponentGroup({
        ctx: { ...teamCtx, db: tx },
        input: {
          pageId: testPageId,
          name: `${TEST_PREFIX}-group`,
          defaultOpen: true,
        },
      });

      expect(created.name).toBe(`${TEST_PREFIX}-group`);
      expect(created.defaultOpen).toBe(true);
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "page_component_group.create",
        entityType: "page_component_group",
        entityId: created.id,
        db: tx,
      });
    });
  });

  test("rejects a page from another workspace", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createPageComponentGroup({
          ctx: { ...freeCtx, db: tx },
          input: {
            pageId: testPageId,
            name: `${TEST_PREFIX}-cross`,
            defaultOpen: false,
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("updatePageComponentGroup", () => {
  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        updatePageComponentGroup({
          ctx: readOnlyCtx(teamCtx, tx),
          input: { id: 999_999_999, name: "nope" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("patches only the supplied fields and emits an audit row", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const created = await createPageComponentGroup({
        ctx: teamCtxTx,
        input: {
          pageId: testPageId,
          name: `${TEST_PREFIX}-before`,
          defaultOpen: true,
        },
      });

      const updated = await updatePageComponentGroup({
        ctx: teamCtxTx,
        input: { id: created.id, name: `${TEST_PREFIX}-after` },
      });

      expect(updated.name).toBe(`${TEST_PREFIX}-after`);
      expect(updated.defaultOpen).toBe(true);
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "page_component_group.update",
        entityType: "page_component_group",
        entityId: created.id,
        db: tx,
      });
    });
  });

  test("throws NotFoundError for cross-workspace id", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createPageComponentGroup({
        ctx: { ...teamCtx, db: tx },
        input: {
          pageId: testPageId,
          name: `${TEST_PREFIX}-cross-update`,
          defaultOpen: false,
        },
      });

      await expect(
        updatePageComponentGroup({
          ctx: { ...freeCtx, db: tx },
          input: { id: created.id, name: "nope" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("deletePageComponentGroup", () => {
  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        deletePageComponentGroup({
          ctx: readOnlyCtx(teamCtx, tx),
          input: { id: 999_999_999 },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("deletes the group and emits an audit row", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const created = await createPageComponentGroup({
        ctx: teamCtxTx,
        input: {
          pageId: testPageId,
          name: `${TEST_PREFIX}-doomed`,
          defaultOpen: false,
        },
      });

      await deletePageComponentGroup({
        ctx: teamCtxTx,
        input: { id: created.id },
      });

      const remaining = await tx
        .select()
        .from(pageComponentGroup)
        .where(eq(pageComponentGroup.id, created.id))
        .get();
      expect(remaining).toBeUndefined();
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "page_component_group.delete",
        entityType: "page_component_group",
        entityId: created.id,
        db: tx,
      });
    });
  });

  test("throws NotFoundError for cross-workspace id", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createPageComponentGroup({
        ctx: { ...teamCtx, db: tx },
        input: {
          pageId: testPageId,
          name: `${TEST_PREFIX}-cross-delete`,
          defaultOpen: false,
        },
      });

      await expect(
        deletePageComponentGroup({
          ctx: { ...freeCtx, db: tx },
          input: { id: created.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
