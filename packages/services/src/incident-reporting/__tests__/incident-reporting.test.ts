import { db, eq } from "@openstatus/db";
import { incidentSlaPolicy } from "@openstatus/db/src/schema";
import { defaultIncidentSlaTargets } from "@openstatus/db/src/schema/incident_sla_policies/constants";
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
import { deleteIncidentSlaPolicy } from "../delete";
import { getIncidentSlaPolicy } from "../get";
import { upsertIncidentSlaPolicy } from "../upsert";

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
      .delete(incidentSlaPolicy)
      .where(eq(incidentSlaPolicy.workspaceId, id));
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
  targets: defaultIncidentSlaTargets,
  resolutionStop: "mitigated" as const,
};

describe("upsertIncidentSlaPolicy", () => {
  test("the first save creates the policy, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await upsertIncidentSlaPolicy({ ctx, input });

      expect(policy).toMatchObject({
        workspaceId: ctx.workspace.id,
        targets: defaultIncidentSlaTargets,
        resolutionStop: "mitigated",
      });
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "incident_sla_policy.create",
        entityType: "incident_sla_policy",
        entityId: policy.id,
        db: tx,
      });
    });
  });

  test("saving twice updates the one policy, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...adminCtx, db: tx };
      const first = await upsertIncidentSlaPolicy({ ctx, input });
      const second = await upsertIncidentSlaPolicy({
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
      expect(await getIncidentSlaPolicy({ ctx })).toMatchObject({
        id: first.id,
        targets: { critical: { responseMinutes: 30 } },
      });
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "incident_sla_policy.update",
        entityType: "incident_sla_policy",
        entityId: first.id,
        db: tx,
      });
    });
  });

  test("a cleared field is stored as off, not as zero", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await upsertIncidentSlaPolicy({
        ctx: { ...ownerCtx, db: tx },
        input: {
          targets: {
            critical: {
              responseMinutes: 60,
              resolutionMinutes: null,
              updateMinutes: undefined,
            },
          },
          resolutionStop: "mitigated",
        },
      });
      expect(policy.targets).toEqual({ critical: { responseMinutes: 60 } });
    });
  });

  test("a member cannot save", async () => {
    await expect(
      upsertIncidentSlaPolicy({ ctx: memberCtx, input }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      userId: 1,
      scopes: ["read"],
    });
    await expect(
      upsertIncidentSlaPolicy({ ctx, input }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("an API key cannot save, even with incidents:write", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["incidents:write"],
    });
    await expect(
      upsertIncidentSlaPolicy({ ctx, input }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("refused without the incident-sla limit", async () => {
    await expect(
      upsertIncidentSlaPolicy({ ctx: freeCtx, input }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects a policy without any target", async () => {
    await expect(
      upsertIncidentSlaPolicy({
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
      upsertIncidentSlaPolicy({
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
      upsertIncidentSlaPolicy({
        ctx: ownerCtx,
        input: {
          targets: { minor: { updateMinutes: 4 } },
          resolutionStop: "mitigated",
        },
      }),
    ).rejects.toThrow(
      new ValidationError(
        "Minor: the update target must be between 5m and 30d.",
      ),
    );
    await expect(
      upsertIncidentSlaPolicy({
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
      const policy = await upsertIncidentSlaPolicy({
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

describe("getIncidentSlaPolicy", () => {
  test("null without a policy", async () => {
    expect(await getIncidentSlaPolicy({ ctx: ownerCtx })).toBeNull();
  });

  test("a member can read the policy", async () => {
    await withTestTransaction(async (tx) => {
      const saved = await upsertIncidentSlaPolicy({
        ctx: { ...ownerCtx, db: tx },
        input,
      });
      const read = await getIncidentSlaPolicy({
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
    await expect(getIncidentSlaPolicy({ ctx })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("deleteIncidentSlaPolicy", () => {
  test("turning off removes the policy, audited, even without the limit", async () => {
    await withTestTransaction(async (tx) => {
      const saved = await upsertIncidentSlaPolicy({
        ctx: { ...ownerCtx, db: tx },
        input,
      });
      const ctx = withoutLimit({ ...ownerCtx, db: tx });

      await deleteIncidentSlaPolicy({ ctx });

      expect(await getIncidentSlaPolicy({ ctx })).toBeNull();
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "incident_sla_policy.delete",
        entityType: "incident_sla_policy",
        entityId: saved.id,
        db: tx,
      });
    });
  });

  test("not found when there is no policy", async () => {
    await expect(
      deleteIncidentSlaPolicy({ ctx: ownerCtx }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("a member cannot turn it off", async () => {
    await withTestTransaction(async (tx) => {
      await upsertIncidentSlaPolicy({ ctx: { ...ownerCtx, db: tx }, input });
      await expect(
        deleteIncidentSlaPolicy({ ctx: { ...memberCtx, db: tx } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["read"],
    });
    await expect(deleteIncidentSlaPolicy({ ctx })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
