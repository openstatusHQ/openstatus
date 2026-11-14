import { and, asc, eq, like } from "@openstatus/db";
import { incident, incidentEvent } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { ForbiddenError, PreconditionFailedError } from "../../errors";
import { upsertIncidentReporting } from "../../incident-reporting";
import type { Workspace } from "../../types";
import {
  acknowledgeIncident,
  closeIncident,
  declareIncident,
  getIncident,
  setIncidentSlaMissReason,
  setIncidentStatus,
} from "../index";

let team: Workspace;
let ownerId: number;
let memberId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  team = fixture.workspace;
  ownerId = fixture.userId;
  memberId = (await createUser()).id;
  await addUserToWorkspace(memberId, team.id, "member");
});

const withDb = (ctx: ServiceContext, tx: DB): ServiceContext => ({
  ...ctx,
  db: tx,
});
const owner = (tx: DB) => withDb(makeUserCtx(team, { userId: ownerId }), tx);
const member = (tx: DB) => withDb(makeUserCtx(team, { userId: memberId }), tx);
const apiKey = (tx: DB, scopes?: ("incidents:read" | "incidents:write")[]) =>
  withDb(makeApiKeyCtx(team, { keyId: "k_miss", scopes }), tx);

async function declare(tx: DB, tracked = true) {
  if (tracked) {
    await upsertIncidentReporting({
      ctx: owner(tx),
      input: {
        targets: {
          critical: { responseMinutes: 60, resolutionMinutes: 240 },
        },
        resolutionStop: "resolved",
      },
    });
  }
  return declareIncident({
    ctx: apiKey(tx),
    input: { title: "Checkout down", severity: "critical" },
  });
}

// Moves the declare back; the DB stores seconds.
async function declaredMinutesAgo(tx: DB, id: number, minutes: number) {
  const declaredAt = new Date(
    Math.floor((Date.now() - minutes * 60_000) / 1000) * 1000,
  );
  await tx.update(incident).set({ declaredAt }).where(eq(incident.id, id));
}

/** An incident whose response was acknowledged late, so the miss is recorded. */
async function lateResponse(tx: DB) {
  const declared = await declare(tx);
  await declaredMinutesAgo(tx, declared.id, 90);
  await acknowledgeIncident({ ctx: member(tx), input: { id: declared.id } });
  return declared;
}

async function sla(tx: DB, id: number) {
  return (await getIncident({ ctx: member(tx), input: { id } })).sla;
}

describe("setIncidentSlaMissReason", () => {
  test("a member explains a missed response; the incident reads it back", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await lateResponse(tx);
      const updated = await setIncidentSlaMissReason({
        ctx: member(tx),
        input: {
          id: declared.id,
          kind: "response",
          reason: "  Pager rotation gap overnight ",
        },
      });
      expect(updated.responseMissReason).toBe("Pager rotation gap overnight");
      expect((await sla(tx, declared.id))?.response?.missReason).toBe(
        "Pager rotation gap overnight",
      );
      await expectAuditRow({
        workspaceId: team.id,
        action: "incident.update",
        entityType: "incident",
        entityId: declared.id,
        actorType: "user",
        db: tx,
      });
    });
  });

  test("the reason is editable and clears when emptied", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await lateResponse(tx);
      const write = (reason: string | null) =>
        setIncidentSlaMissReason({
          ctx: member(tx),
          input: { id: declared.id, kind: "response", reason },
        });
      await write("First draft");
      await write("Escalation policy pointed at a deleted user");
      expect((await sla(tx, declared.id))?.response?.missReason).toBe(
        "Escalation policy pointed at a deleted user",
      );
      await write("   ");
      expect((await sla(tx, declared.id))?.response?.missReason).toBeNull();
      await write("Back again");
      await write(null);
      expect((await sla(tx, declared.id))?.response?.missReason).toBeNull();
    });
  });

  test("each change appends an event with its author; an unchanged save does not", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await lateResponse(tx);
      const write = (reason: string | null) =>
        setIncidentSlaMissReason({
          ctx: member(tx),
          input: { id: declared.id, kind: "response", reason },
        });
      await write("Pager rotation gap");
      await write("Pager rotation gap");
      await write("Escalation policy pointed at a deleted user");
      await write("");
      const events = await tx
        .select()
        .from(incidentEvent)
        .where(
          and(
            eq(incidentEvent.incidentId, declared.id),
            like(incidentEvent.type, "sla_%_miss_explained"),
          ),
        )
        .orderBy(asc(incidentEvent.id))
        .all();
      expect(events.map((e) => [e.type, e.message, e.createdBy])).toStrictEqual(
        [
          ["sla_response_miss_explained", "Pager rotation gap", memberId],
          [
            "sla_response_miss_explained",
            "Escalation policy pointed at a deleted user",
            memberId,
          ],
          ["sla_response_miss_explained", null, memberId],
        ],
      );
    });
  });

  test("explains a missed resolution, also after the incident is closed", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx);
      await declaredMinutesAgo(tx, declared.id, 300);
      await setIncidentStatus({
        ctx: owner(tx),
        input: { id: declared.id, status: "resolved" },
      });
      await closeIncident({
        ctx: owner(tx),
        input: { id: declared.id, skipPostmortem: true },
      });
      await setIncidentSlaMissReason({
        ctx: member(tx),
        input: {
          id: declared.id,
          kind: "resolution",
          reason: "Upstream vendor outage",
        },
      });
      const state = await sla(tx, declared.id);
      expect(state?.resolution?.missReason).toBe("Upstream vendor outage");
      expect(state?.response?.missReason).toBeNull();
    });
  });

  test("refuses a target that is not recorded as missed", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await lateResponse(tx);
      // resolution is still running
      await expect(
        setIncidentSlaMissReason({
          ctx: member(tx),
          input: { id: declared.id, kind: "resolution", reason: "Too early" },
        }),
      ).rejects.toThrow(PreconditionFailedError);

      const onTime = await declare(tx);
      await acknowledgeIncident({ ctx: member(tx), input: { id: onTime.id } });
      await expect(
        setIncidentSlaMissReason({
          ctx: member(tx),
          input: { id: onTime.id, kind: "response", reason: "Met anyway" },
        }),
      ).rejects.toThrow(PreconditionFailedError);
    });
  });

  test("refuses an untracked incident", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, false);
      await expect(
        setIncidentSlaMissReason({
          ctx: member(tx),
          input: { id: declared.id, kind: "response", reason: "Nothing" },
        }),
      ).rejects.toThrow(PreconditionFailedError);
    });
  });

  test("a write key may explain a miss", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await lateResponse(tx);
      const updated = await setIncidentSlaMissReason({
        ctx: apiKey(tx, ["incidents:write"]),
        input: { id: declared.id, kind: "response", reason: "Holiday" },
      });
      expect(updated.responseMissReason).toBe("Holiday");
    });
  });

  test("rejects read-only actor", async () => {
    await expect(
      setIncidentSlaMissReason({
        ctx: makeApiKeyCtx(team, { keyId: "k_ro", scopes: ["incidents:read"] }),
        input: { id: 1, kind: "response", reason: "No" },
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
