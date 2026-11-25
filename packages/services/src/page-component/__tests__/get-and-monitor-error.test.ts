import {
  createMonitor,
  createPage,
  createPageComponent as createComponentRow,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { createPageComponent } from "../create";
import { getPageComponent } from "../list";

let teamCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  teamCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 1,
  });
  otherCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 2,
  });
});

describe("getPageComponent", () => {
  test("returns the component in the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const wsId = teamCtx.workspace.id;
      const p = await createPage(wsId, {}, tx);
      const c = await createComponentRow(wsId, p.id, { name: "API" }, tx);
      const row = await getPageComponent({
        ctx: { ...teamCtx, db: tx },
        input: { id: c.id },
      });
      expect(row).toMatchObject({ id: c.id, pageId: p.id, name: "API" });
    });
  });

  test("another workspace's component is NotFound", async () => {
    await withTestTransaction(async (tx) => {
      const wsId = teamCtx.workspace.id;
      const p = await createPage(wsId, {}, tx);
      const c = await createComponentRow(wsId, p.id, {}, tx);
      const err = await getPageComponent({
        ctx: { ...otherCtx, db: tx },
        input: { id: c.id },
      }).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).entity).toBe("page_component");
    });
  });

  test("needs pages:read", async () => {
    await withTestTransaction(async (tx) => {
      const wsId = teamCtx.workspace.id;
      const p = await createPage(wsId, {}, tx);
      const c = await createComponentRow(wsId, p.id, {}, tx);
      await expect(
        getPageComponent({
          ctx: {
            ...makeApiKeyCtx(teamCtx.workspace, {
              keyId: "k",
              scopes: ["monitors:write"],
            }),
            db: tx,
          },
          input: { id: c.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("createPageComponent monitor errors", () => {
  test("a foreign, a soft-deleted and an unknown monitor are the same NotFound", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(teamCtx.workspace.id, {}, tx);
      const foreign = await createMonitor(otherCtx.workspace.id, {}, tx);
      const deleted = await createMonitor(
        teamCtx.workspace.id,
        { deletedAt: new Date() },
        tx,
      );
      const errors = [];
      for (const monitorId of [foreign.id, deleted.id, 99_999_999]) {
        errors.push(
          await createPageComponent({
            ctx: { ...teamCtx, db: tx },
            input: { pageId: p.id, type: "monitor", monitorId, order: 0 },
          }).catch((e) => e),
        );
      }
      for (const [i, err] of errors.entries()) {
        expect(err).toBeInstanceOf(NotFoundError);
        expect((err as NotFoundError).entity).toBe("monitor");
        expect((err as Error).message).toBe(
          `monitor ${[foreign.id, deleted.id, 99_999_999][i]} not found`,
        );
      }
    });
  });
});
