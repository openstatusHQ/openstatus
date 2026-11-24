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
import {
  ForbiddenError,
  MonitorNotInWorkspaceError,
  NotFoundError,
} from "../../errors";
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
  test("a monitor from another workspace is a MonitorNotInWorkspaceError, still a ForbiddenError", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(teamCtx.workspace.id, {}, tx);
      const foreign = await createMonitor(otherCtx.workspace.id, {}, tx);
      const err = await createPageComponent({
        ctx: { ...teamCtx, db: tx },
        input: {
          pageId: p.id,
          type: "monitor",
          monitorId: foreign.id,
          order: 0,
        },
      }).catch((e) => e);
      expect(err).toBeInstanceOf(MonitorNotInWorkspaceError);
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as MonitorNotInWorkspaceError).monitorId).toBe(foreign.id);
      expect((err as Error).message).toBe("Invalid monitor IDs.");
    });
  });
});
