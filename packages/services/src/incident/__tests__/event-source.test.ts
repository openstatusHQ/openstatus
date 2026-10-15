import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeMcpCtx,
  makeSlackCtx,
  makeSystemCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { Actor, DB, ServiceContext } from "../../context";
import type { Workspace } from "../../types";
import {
  addIncidentNote,
  declareIncident,
  draftPostmortem,
  setIncidentStatus,
} from "../index";
import { appendIncidentEvent } from "../internal";

let workspace: Workspace;
let memberId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  memberId = (await createUser()).id;
  await addUserToWorkspace(memberId, workspace.id, "member");
});

const as = (userId: number, tx: DB): ServiceContext => ({
  ...makeUserCtx(workspace, { userId }),
  db: tx,
});

async function declare(tx: DB) {
  return declareIncident({
    ctx: as(memberId, tx),
    input: { title: "API down", severity: "major" },
  });
}

describe("incident event source", () => {
  const cases: Array<{
    ctx: () => ServiceContext;
    source: string;
    sourceRef: string | null;
  }> = [
    {
      ctx: () => makeUserCtx(workspace, { userId: memberId }),
      source: "dashboard",
      sourceRef: null,
    },
    {
      ctx: () => makeApiKeyCtx(workspace, { keyId: "key_api" }),
      source: "api",
      sourceRef: "key_api",
    },
    {
      ctx: () => makeMcpCtx(workspace, { keyId: "key_mcp" }),
      source: "mcp",
      sourceRef: "key_mcp",
    },
    {
      ctx: () =>
        makeSlackCtx(workspace, {
          teamId: "T1",
          slackUserId: "U1",
          userId: memberId,
        }),
      source: "slack",
      sourceRef: null,
    },
    {
      ctx: () => makeSystemCtx(workspace, { job: "test" }),
      source: "system",
      sourceRef: null,
    },
    ...(
      [
        { type: "webhook", source: "github" },
        { type: "subscriber", subscriberId: 1 },
      ] satisfies Actor[]
    ).map((actor) => ({
      ctx: () => ({ workspace, actor }),
      source: "system",
      sourceRef: null,
    })),
  ];

  for (const c of cases) {
    test(`${c.ctx().actor.type} is stored as ${c.source}`, async () => {
      await withTestTransaction(async (tx) => {
        const row = await declare(tx);
        const event = await appendIncidentEvent(
          tx,
          { ...c.ctx(), db: tx },
          { incidentId: row.id, type: "note", message: "hi" },
        );
        expect(event.source).toBe(c.source);
        expect(event.sourceRef).toBe(c.sourceRef);
      });
    });
  }

  test("a dashboard write stores no ref", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const note = await addIncidentNote({
        ctx: as(memberId, tx),
        input: { id: row.id, message: "Looking" },
      });
      expect(note.source).toBe("dashboard");
      expect(note.sourceRef).toBeNull();
    });
  });

  test("the Slack actor's permalink lands on the event", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const note = await addIncidentNote({
        ctx: {
          ...makeSlackCtx(workspace, {
            teamId: "T1",
            slackUserId: "U1",
            userId: memberId,
            permalink: "https://slack.test/archives/C1/p1",
          }),
          db: tx,
        },
        input: { id: row.id, message: "Rolled back" },
      });
      expect(note.source).toBe("slack");
      expect(note.sourceRef).toBe("https://slack.test/archives/C1/p1");
      expect(note.message).toBe("Rolled back");
    });
  });

  test("an agent-drafted postmortem is credited to the agent", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      await setIncidentStatus({
        ctx: as(memberId, tx),
        input: { id: row.id, status: "resolved" },
      });
      const ctx: ServiceContext = {
        ...makeSlackCtx(workspace, {
          teamId: "T1",
          slackUserId: "U1",
          userId: memberId,
          permalink: "https://slack.test/archives/C1/p2",
        }),
        db: tx,
      };
      await draftPostmortem({
        ctx,
        input: { id: row.id, content: "First", draftedBy: "agent" },
      });
      await draftPostmortem({
        ctx,
        input: { id: row.id, content: "Second", draftedBy: "user" },
      });
      const events = await tx.query.incidentEvent.findMany({
        where: (e, { and, eq, like }) =>
          and(eq(e.incidentId, row.id), like(e.type, "postmortem_%")),
        orderBy: (e, { asc }) => [asc(e.id)],
      });
      expect(
        events.map((e) => ({ source: e.source, sourceRef: e.sourceRef })),
      ).toEqual([
        { source: "agent", sourceRef: null },
        { source: "slack", sourceRef: "https://slack.test/archives/C1/p2" },
      ]);
    });
  });
});
