import { db, eq } from "@openstatus/db";
import { maintenance, page } from "@openstatus/db/src/schema";
import { createUser } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeSystemCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { createMaintenance } from "../create";
import { getMaintenance } from "../list";
import { updateMaintenance } from "../update";

const TEST_PREFIX = "svc-maintenance-attribution";

let teamCtx: ServiceContext;
let ownerId: number;
let pageId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  ownerId = fixture.userId;
  teamCtx = makeUserCtx(fixture.workspace, { userId: ownerId });
  const row = await db
    .insert(page)
    .values({
      workspaceId: fixture.workspace.id,
      title: `${TEST_PREFIX}-page`,
      description: "",
      slug: `${TEST_PREFIX}-${fixture.workspace.id}`,
      customDomain: "",
    })
    .returning()
    .get();
  pageId = row.id;
});

function range() {
  const from = new Date(Date.now() + 60 * 60 * 1000);
  return { from, to: new Date(from.getTime() + 60 * 60 * 1000) };
}

async function create(ctx: ServiceContext, title: string) {
  return createMaintenance({
    ctx,
    input: {
      title: `${TEST_PREFIX}-${title}`,
      message: "planned",
      ...range(),
      pageId,
      pageComponentIds: [],
    },
  });
}

describe("maintenance attribution", () => {
  test("user actor stamps both columns and reads back", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const record = await create(ctx, "user");
      expect(record.createdBy).toBe(ownerId);
      expect(record.updatedBy).toBe(ownerId);

      const full = await getMaintenance({ ctx, input: { id: record.id } });
      expect(full.createdByUser).toEqual({ id: ownerId, name: "Test User" });
      expect(full.updatedByUser).toEqual({ id: ownerId, name: "Test User" });
    });
  });

  test("api key without a user and system actor leave NULL", async () => {
    await withTestTransaction(async (tx) => {
      const anonKey = {
        ...makeApiKeyCtx(teamCtx.workspace, { keyId: "k", scopes: ["write"] }),
        db: tx,
      };
      const viaKey = await create(anonKey, "key");
      expect(viaKey.createdBy).toBeNull();
      expect(viaKey.updatedBy).toBeNull();

      const system = {
        ...makeSystemCtx(teamCtx.workspace, { job: "test" }),
        db: tx,
      };
      const viaSystem = await create(system, "system");
      expect(viaSystem.createdBy).toBeNull();

      const full = await getMaintenance({
        ctx: anonKey,
        input: { id: viaKey.id },
      });
      expect(full.createdByUser).toBeNull();
    });
  });

  test("update moves updated_by and keeps created_by", async () => {
    await withTestTransaction(async (tx) => {
      const editor = await createUser({}, tx);
      const record = await create({ ...teamCtx, db: tx }, "edit");
      await updateMaintenance({
        ctx: {
          ...makeUserCtx(teamCtx.workspace, { userId: editor.id }),
          db: tx,
        },
        input: { id: record.id, title: `${TEST_PREFIX}-renamed` },
      });
      const row = await tx
        .select()
        .from(maintenance)
        .where(eq(maintenance.id, record.id))
        .get();
      expect(row?.createdBy).toBe(ownerId);
      expect(row?.updatedBy).toBe(editor.id);
    });
  });
});
