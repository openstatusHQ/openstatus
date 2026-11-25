import { createPage } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import type { Workspace } from "../../types";
import { subscribeEmailInWorkspace } from "../subscribe-in-workspace";

let team: Workspace;
let other: Workspace;

beforeAll(async () => {
  team = (await createWorkspaceFixture("team")).workspace;
  other = (await createWorkspaceFixture("team")).workspace;
});

const keyCtx = (
  ws: Workspace,
  tx: DrizzleTx,
  scopes: Parameters<typeof makeApiKeyCtx>[1]["scopes"] = ["subscribers:write"],
) => ({ ...makeApiKeyCtx(ws, { keyId: "k", scopes }), db: tx });

describe("subscribeEmailInWorkspace", () => {
  test("creates a pending subscriber and returns the stored row", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(team.id, {}, tx);
      const { subscriber, row } = await subscribeEmailInWorkspace({
        ctx: keyCtx(team, tx),
        input: { email: "Jane@Acme.com", pageId: p.id },
      });
      expect(row.id).toBe(subscriber.id);
      expect(row.pageId).toBe(p.id);
      expect(row.email).toBe("jane@acme.com");
      expect(row.acceptedAt).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(subscriber.token).toBe(row.token);
    });
  });

  test("returns the existing row when the email is already subscribed", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(team.id, {}, tx);
      const input = { email: "repeat@acme.com", pageId: p.id };
      const first = await subscribeEmailInWorkspace({
        ctx: keyCtx(team, tx),
        input,
      });
      const second = await subscribeEmailInWorkspace({
        ctx: keyCtx(team, tx),
        input,
      });
      expect(second.row.id).toBe(first.row.id);
    });
  });

  test("a page in another workspace is NotFound and nothing is written", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(other.id, {}, tx);
      const err = await subscribeEmailInWorkspace({
        ctx: keyCtx(team, tx),
        input: { email: "outsider@acme.com", pageId: p.id },
      }).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).entity).toBe("page");
      const rows = await tx.query.pageSubscriber.findMany({
        where: { pageId: p.id },
      });
      expect(rows).toEqual([]);
    });
  });

  test("needs subscribers:write", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(team.id, {}, tx);
      for (const scopes of [["pages:write"], ["subscribers:read"]] as const) {
        await expect(
          subscribeEmailInWorkspace({
            ctx: keyCtx(team, tx, [...scopes]),
            input: { email: "scoped@acme.com", pageId: p.id },
          }),
        ).rejects.toBeInstanceOf(ForbiddenError);
      }
    });
  });
});
