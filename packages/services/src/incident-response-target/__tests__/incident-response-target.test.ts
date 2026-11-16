import { db, eq } from "@openstatus/db";
import { incidentResponseTarget } from "@openstatus/db/src/schema";
import { defaultIncidentTargetTargets } from "@openstatus/db/src/schema/incident_response_targets/constants";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLog,
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import { deleteIncidentResponseTarget } from "../delete";
import { getIncidentResponseTarget } from "../get";
import { upsertIncidentResponseTarget } from "../upsert";

let ownerCtx: ServiceContext;
let adminCtx: ServiceContext;
let memberCtx: ServiceContext;
let freeCtx: ServiceContext;
const workspaceIds: number[] = [];

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  const free = await createWorkspaceFixture("free");
  workspaceIds.push(team.workspace.id, free.workspace.id);
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });

  const admin = await createUser();
  await addUserToWorkspace(admin.id, team.workspace.id, "admin");
  adminCtx = makeUserCtx(team.workspace, { userId: admin.id });
  const member = await createUser();
  await addUserToWorkspace(member.id, team.workspace.id, "member");
  memberCtx = makeUserCtx(team.workspace, { userId: member.id });
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db
      .delete(incidentResponseTarget)
      .where(eq(incidentResponseTarget.workspaceId, id));
  }
});

function withoutLimit(ctx: ServiceContext): ServiceContext {
  return {
    ...ctx,
    workspace: {
      ...ctx.workspace,
      limits: { ...ctx.workspace.limits, "incident-sla": false },
    },
  };
}

const input = {
  targets: defaultIncidentTargetTargets,
  resolutionStop: "mitigated" as const,
};

describe("upsertIncidentResponseTarget", () => {
  test("the first save creates the policy, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await upsertIncidentResponseTarget({ ctx, input });

      expect(policy).toMatchObject({
        workspaceId: ctx.workspace.id,
        targets: defaultIncidentTargetTargets,
        resolutionStop: "mitigated",
      });
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "incident_response_target.create",
        entityType: "incident_response_target",
        entityId: policy.id,
        db: tx,
      });
    });
  });

  test("saving twice updates the one policy, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...adminCtx, db: tx };
      const first = await upsertIncidentResponseTarget({ ctx, input });
      const second = await upsertIncidentResponseTarget({
        ctx,
        input: {
          targets: { critical: { responseMinutes: 30 }, minor: {} },
          resolutionStop: "resolved",
        },
      });

      expect(second.id).toBe(first.id);
      expect(second).toMatchObject({
        targets: { critical: { responseMinutes: 30 } },
        resolutionStop: "resolved",
      });
      expect(await getIncidentResponseTarget({ ctx })).toMatchObject({
        id: first.id,
        targets: { critical: { responseMinutes: 30 } },
      });
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "incident_response_target.update",
        entityType: "incident_response_target",
        entityId: first.id,
        db: tx,
      });
    });
  });

  test("a cleared field is stored as off, not as zero", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await upsertIncidentResponseTarget({
        ctx: { ...ownerCtx, db: tx },
        input: {
          targets: {
            critical: { responseMinutes: 60, resolutionMinutes: null },
          },
          resolutionStop: "mitigated",
        },
      });
      expect(policy.targets).toEqual({ critical: { responseMinutes: 60 } });
    });
  });

  test("a member cannot save", async () => {
    await expect(
      upsertIncidentResponseTarget({ ctx: memberCtx, input }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      userId: 1,
      scopes: ["read"],
    });
    await expect(
      upsertIncidentResponseTarget({ ctx, input }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("an API key cannot save, even with incidents:write", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["incidents:write"],
    });
    await expect(
      upsertIncidentResponseTarget({ ctx, input }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("refused without the incident-target limit", async () => {
    await expect(
      upsertIncidentResponseTarget({ ctx: freeCtx, input }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects a policy without any target", async () => {
    await expect(
      upsertIncidentResponseTarget({
        ctx: ownerCtx,
        input: {
          targets: { critical: { responseMinutes: null }, major: {} },
          resolutionStop: "mitigated",
        },
      }),
    ).rejects.toThrow(new ValidationError("Set at least one target."));
  });

  test("rejects a response target longer than the resolution target, by field", async () => {
    await expect(
      upsertIncidentResponseTarget({
        ctx: ownerCtx,
        input: {
          targets: {
            major: { responseMinutes: 300, resolutionMinutes: 240 },
          },
          resolutionStop: "mitigated",
        },
      }),
    ).rejects.toThrow(
      new ValidationError(
        "Major: the response target cannot be longer than the resolution target.",
      ),
    );
  });

  test("rejects a value outside 5 minutes to 30 days, by field", async () => {
    await expect(
      upsertIncidentResponseTarget({
        ctx: ownerCtx,
        input: {
          targets: { minor: { responseMinutes: 4 } },
          resolutionStop: "mitigated",
        },
      }),
    ).rejects.toThrow(
      new ValidationError(
        "Minor: the response target must be between 5m and 30d.",
      ),
    );
    await expect(
      upsertIncidentResponseTarget({
        ctx: ownerCtx,
        input: {
          targets: { critical: { resolutionMinutes: 30 * 24 * 60 + 1 } },
          resolutionStop: "mitigated",
        },
      }),
    ).rejects.toThrow(
      "Critical: the resolution target must be between 5m and 30d.",
    );
  });

  test("the boundaries 5 minutes and 30 days are accepted", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await upsertIncidentResponseTarget({
        ctx: { ...ownerCtx, db: tx },
        input: {
          targets: {
            critical: { responseMinutes: 5, resolutionMinutes: 30 * 24 * 60 },
          },
          resolutionStop: "mitigated",
        },
      });
      expect(policy.targets.critical?.resolutionMinutes).toBe(43_200);
    });
  });
});

describe("getIncidentResponseTarget", () => {
  test("null without a policy", async () => {
    expect(await getIncidentResponseTarget({ ctx: ownerCtx })).toBeNull();
  });

  test("a member can read the policy", async () => {
    await withTestTransaction(async (tx) => {
      const saved = await upsertIncidentResponseTarget({
        ctx: { ...ownerCtx, db: tx },
        input,
      });
      const read = await getIncidentResponseTarget({
        ctx: { ...memberCtx, db: tx },
      });
      expect(read?.id).toBe(saved.id);
    });
  });

  test("rejects other-group key", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["monitors:read"],
    });
    await expect(getIncidentResponseTarget({ ctx })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("deleteIncidentResponseTarget", () => {
  test("turning off removes the policy, audited, even without the limit", async () => {
    await withTestTransaction(async (tx) => {
      const saved = await upsertIncidentResponseTarget({
        ctx: { ...ownerCtx, db: tx },
        input,
      });
      const ctx = withoutLimit({ ...ownerCtx, db: tx });

      await deleteIncidentResponseTarget({ ctx });

      expect(await getIncidentResponseTarget({ ctx })).toBeNull();
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "incident_response_target.delete",
        entityType: "incident_response_target",
        entityId: saved.id,
        db: tx,
      });
    });
  });

  test("not found when there is no policy", async () => {
    await expect(
      deleteIncidentResponseTarget({ ctx: ownerCtx }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("a member cannot turn it off", async () => {
    await withTestTransaction(async (tx) => {
      await upsertIncidentResponseTarget({
        ctx: { ...ownerCtx, db: tx },
        input,
      });
      await expect(
        deleteIncidentResponseTarget({ ctx: { ...memberCtx, db: tx } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["read"],
    });
    await expect(deleteIncidentResponseTarget({ ctx })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
