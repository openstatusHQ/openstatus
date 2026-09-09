import { db, eq } from "@openstatus/db";
import { alertSource } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { findOrCreateAlertSource } from "../find-or-create";
import {
  listAlertSources,
  setAlertSourceActive,
  updateAlertSourceConfig,
} from "../manage";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  teamCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 1,
  });
  freeCtx = makeUserCtx((await createWorkspaceFixture("free")).workspace, {
    userId: 2,
  });
  otherCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 3,
  });
});

afterEach(async () => {
  for (const ctx of [teamCtx, freeCtx, otherCtx]) {
    await db
      .delete(alertSource)
      .where(eq(alertSource.workspaceId, ctx.workspace.id));
  }
});

describe("findOrCreateAlertSource", () => {
  test("creates on first delivery, then finds", async () => {
    const first = await findOrCreateAlertSource({
      ctx: teamCtx,
      input: { provider: "alertmanager" },
    });
    expect(first.created).toBe(true);
    expect(first.overLimit).toBe(false);
    expect(first.source.provider).toBe("alertmanager");

    await expectAuditRow({
      workspaceId: teamCtx.workspace.id,
      action: "alert_source.create",
      entityType: "alert_source",
      entityId: first.source.id,
    });

    const second = await findOrCreateAlertSource({
      ctx: teamCtx,
      input: { provider: "alertmanager" },
    });
    expect(second.created).toBe(false);
    expect(second.source.id).toBe(first.source.id);
  });

  test("creates past the limit but reports overLimit, so payloads still attach", async () => {
    const first = await findOrCreateAlertSource({
      ctx: freeCtx,
      input: { provider: "alertmanager" },
    });
    expect(first.overLimit).toBe(false);

    const second = await findOrCreateAlertSource({
      ctx: freeCtx,
      input: { provider: "grafana" },
    });
    // The row exists — nothing is dropped — but it is flagged.
    expect(second.source.id).toBeTruthy();
    expect(second.overLimit).toBe(true);
  });

  test("rejects a read-only actor", async () => {
    const ctx = makeApiKeyCtx(teamCtx.workspace, {
      keyId: "k1",
      scopes: ["read"],
    });
    await expect(
      findOrCreateAlertSource({ ctx, input: { provider: "grafana" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("manage", () => {
  test("lists only this workspace's sources", async () => {
    await findOrCreateAlertSource({
      ctx: teamCtx,
      input: { provider: "alertmanager" },
    });
    await findOrCreateAlertSource({
      ctx: otherCtx,
      input: { provider: "alertmanager" },
    });

    const mine = await listAlertSources({ ctx: teamCtx });
    expect(mine).toHaveLength(1);
    expect(mine[0].workspaceId).toBe(teamCtx.workspace.id);
  });

  test("updates the staleness window and keeps the secret out of the audit log", async () => {
    const { source } = await findOrCreateAlertSource({
      ctx: teamCtx,
      input: { provider: "alertmanager" },
    });

    const updated = await updateAlertSourceConfig({
      ctx: teamCtx,
      input: {
        id: source.id,
        stalenessWindowMinutes: 15,
        signatureSecret: "s3cret",
      },
    });
    expect(updated.config.stalenessWindowMinutes).toBe(15);
    expect(updated.config.signatureSecret).toBe("s3cret");

    const row = await expectAuditRow({
      workspaceId: teamCtx.workspace.id,
      action: "alert_source.update",
      entityType: "alert_source",
      entityId: source.id,
    });
    expect(JSON.stringify(row)).not.toContain("s3cret");
  });

  test("deactivating stops the source without deleting it", async () => {
    const { source } = await findOrCreateAlertSource({
      ctx: teamCtx,
      input: { provider: "alertmanager" },
    });
    const off = await setAlertSourceActive({
      ctx: teamCtx,
      input: { id: source.id, active: false },
    });
    expect(off.active).toBe(false);
  });

  test("another workspace cannot touch the source", async () => {
    const { source } = await findOrCreateAlertSource({
      ctx: teamCtx,
      input: { provider: "alertmanager" },
    });
    await expect(
      setAlertSourceActive({
        ctx: otherCtx,
        input: { id: source.id, active: false },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
