import {
  type DescMessage,
  fromJson,
  type JsonObject,
  type JsonValue,
  type MessageShape,
} from "@bufbuild/protobuf";
import { db, eq } from "@openstatus/db";
import {
  incident,
  integration,
  oauthClient,
  oauthGrant,
  page,
  statusReport,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createIncident,
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import {
  AddIncidentNoteResponseSchema,
  ApprovePostmortemResponseSchema,
  CloseIncidentResponseSchema,
  DeclareIncidentResponseSchema,
  DeleteIncidentResponseSchema,
  GetIncidentResponseSchema,
  GetPostmortemResponseSchema,
  IncidentEventType,
  IncidentSeverity,
  IncidentStatus,
  LinkStatusReportResponseSchema,
  ListIncidentsResponseSchema,
  PostmortemAuthor,
  PostmortemStatus,
  SetIncidentStatusResponseSchema,
  UnlinkStatusReportResponseSchema,
  UpdateIncidentResponseSchema,
  UpdatePostmortemResponseSchema,
} from "@openstatus/proto/incident/v1";
import {
  CreateStatusReportResponseSchema,
  GetStatusReportResponseSchema,
  ListStatusReportsResponseSchema,
} from "@openstatus/proto/status_report/v1";
import { SLACK_BOT_SCOPES } from "@openstatus/services/integration";
import { expect } from "@std/expect";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  test,
} from "@std/testing/bdd";

import { settleBackgroundTasks } from "@/libs/background";
import { incidentCommanderEmails } from "@/libs/test/doubles/emails.mock";
import { slackTestState } from "@/libs/test/doubles/slack-test-state";

import { app } from "../../../../../index";

const TEST_PREFIX = "rpc-incident-test";

type Auth = Record<string, string>;

function post(
  service: string,
  method: string,
  body: JsonObject,
  headers: Auth,
) {
  return app.request(`/rpc/${service}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const INCIDENT = "openstatus.incident.v1.IncidentService";
const STATUS_REPORT = "openstatus.status_report.v1.StatusReportService";

async function rpc<T extends DescMessage>(
  schema: T,
  method: string,
  body: JsonObject,
  headers: Auth,
  service = INCIDENT,
): Promise<MessageShape<T>> {
  const res = await post(service, method, body, headers);
  const json: JsonValue = await res.json();
  if (res.status !== 200) {
    throw new Error(`${method} → ${res.status} ${JSON.stringify(json)}`);
  }
  return fromJson(schema, json);
}

async function rpcError(
  method: string,
  body: JsonObject,
  headers: Auth,
  service = INCIDENT,
): Promise<{ status: number; code: string }> {
  const res = await post(service, method, body, headers);
  const json: { code?: string } = await res.json();
  return { status: res.status, code: json.code ?? "" };
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let workspaceId: number;
let otherWorkspaceId: number;
let pageId: number;
let ownerEmail: string;
let adminEmail: string;
let memberEmail: string;
let clientId: string;

let owner: Auth;
let admin: Auth;
let member: Auth;
// Dev keys resolve to the workspace with no creator behind them.
let keyWithoutCreator: Auth;

async function tokenFor(userId: number): Promise<Auth> {
  const token = `os_oat_${crypto.randomUUID().replaceAll("-", "")}`;
  const later = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(oauthGrant).values({
    clientId,
    userId,
    workspaceId,
    scope: ["write"],
    accessTokenHash: await sha256Hex(token),
    accessTokenExpiresAt: later,
    refreshTokenHash: await sha256Hex(`${token}-refresh`),
    refreshTokenExpiresAt: later,
  });
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const fixture = await createTestWorkspace({ plan: "team" });
  workspaceId = fixture.workspace.id;
  ownerEmail = fixture.user.email as string;
  otherWorkspaceId = (await createTestWorkspace({ plan: "team" })).workspace.id;

  const adminUser = await createUser();
  const memberUser = await createUser();
  adminEmail = adminUser.email as string;
  memberEmail = memberUser.email as string;
  await addUserToWorkspace(adminUser.id, workspaceId, "admin");
  await addUserToWorkspace(memberUser.id, workspaceId, "member");

  clientId = `${TEST_PREFIX}-${workspaceId}`;
  await db.insert(oauthClient).values({
    clientId,
    redirectUris: ["http://localhost/callback"],
  });
  owner = await tokenFor(fixture.user.id);
  admin = await tokenFor(adminUser.id);
  member = await tokenFor(memberUser.id);
  keyWithoutCreator = { "x-openstatus-key": String(workspaceId) };

  const row = await db
    .insert(page)
    .values({
      workspaceId,
      title: `${TEST_PREFIX}-page`,
      description: "",
      slug: `${TEST_PREFIX}-${workspaceId}`,
      customDomain: "",
    })
    .returning()
    .get();
  pageId = row.id;

  await db.insert(integration).values({
    name: "slack-agent",
    workspaceId,
    externalId: "T_RPC",
    credential: { botToken: "xoxb-test", botUserId: "UBOT" },
    data: { teamId: "T_RPC", scopes: SLACK_BOT_SCOPES.join(",") },
  });
});

afterAll(async () => {
  await db.delete(incident).where(eq(incident.workspaceId, workspaceId));
  await db.delete(incident).where(eq(incident.workspaceId, otherWorkspaceId));
  await db
    .delete(statusReport)
    .where(eq(statusReport.workspaceId, workspaceId));
  await db.delete(page).where(eq(page.workspaceId, workspaceId));
  await db.delete(integration).where(eq(integration.workspaceId, workspaceId));
  await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId));
});

beforeEach(() => {
  slackTestState.calls = [];
  incidentCommanderEmails.length = 0;
});

async function declare(
  headers: Auth = owner,
  body: JsonObject = {},
): Promise<string> {
  const res = await rpc(
    DeclareIncidentResponseSchema,
    "DeclareIncident",
    {
      title: `${TEST_PREFIX} API down`,
      severity: "INCIDENT_SEVERITY_MAJOR",
      ...body,
    },
    headers,
  );
  return res.incident?.id ?? "";
}

function setStatus(
  id: string,
  status: string,
  headers: Auth = owner,
  note?: string,
) {
  return rpc(
    SetIncidentStatusResponseSchema,
    "SetIncidentStatus",
    note === undefined ? { id, status } : { id, status, note },
    headers,
  );
}

async function get(id: string, headers: Auth = owner) {
  const res = await rpc(
    GetIncidentResponseSchema,
    "GetIncident",
    { id },
    headers,
  );
  if (!res.incident) throw new Error("no incident in response");
  return res.incident;
}

async function bindChannel(id: string) {
  await db
    .update(incident)
    .set({ slackTeamId: "T_RPC", slackChannelId: `C_${id}` })
    .where(eq(incident.id, Number(id)));
}

function slackCalls(method: string) {
  return slackTestState.calls.filter((c) => c.method === method);
}

async function createReport(headers: Auth, incidentId?: string) {
  return rpc(
    CreateStatusReportResponseSchema,
    "CreateStatusReport",
    {
      title: `${TEST_PREFIX} report`,
      status: "STATUS_REPORT_STATUS_INVESTIGATING",
      message: "Looking into it",
      date: new Date().toISOString(),
      pageId: String(pageId),
      ...(incidentId === undefined ? {} : { incidentId }),
    },
    headers,
    STATUS_REPORT,
  );
}

const ID_METHODS: Array<[string, JsonObject]> = [
  ["GetIncident", {}],
  ["UpdateIncident", { title: "x" }],
  ["SetIncidentStatus", { status: "INCIDENT_STATUS_MITIGATED" }],
  ["AddIncidentNote", { message: "x" }],
  ["LinkStatusReport", { statusReportId: "1" }],
  ["UnlinkStatusReport", {}],
  ["CloseIncident", { skipPostmortem: true }],
  ["DeleteIncident", {}],
  ["GetPostmortem", {}],
  ["UpdatePostmortem", { content: "x" }],
  ["ApprovePostmortem", {}],
];

function idField(method: string): string {
  return method.endsWith("Postmortem") ? "incidentId" : "id";
}

describe("IncidentService: common cases", () => {
  test("rejects a request without a key", async () => {
    const res = await post(INCIDENT, "ListIncidents", {}, {});
    expect(res.status).toBe(401);
  });

  for (const [method, extra] of ID_METHODS) {
    test(`${method}: unknown id is not_found`, async () => {
      const err = await rpcError(
        method,
        { [idField(method)]: "999999999", ...extra },
        owner,
      );
      expect(err.code).toBe("not_found");
    });

    test(`${method}: another workspace's incident is not_found`, async () => {
      const theirs = await createIncident(otherWorkspaceId, {
        title: `${TEST_PREFIX}-theirs`,
      });
      const err = await rpcError(
        method,
        { [idField(method)]: String(theirs.id), ...extra },
        owner,
      );
      expect(err.code).toBe("not_found");
    });

    test(`${method}: a non-numeric id is invalid_argument`, async () => {
      const err = await rpcError(
        method,
        { [idField(method)]: "abc", ...extra },
        owner,
      );
      expect(err.code).toBe("invalid_argument");
    });

    test(`${method}: an empty id is invalid_argument`, async () => {
      const err = await rpcError(
        method,
        { [idField(method)]: "", ...extra },
        owner,
      );
      expect(err.code).toBe("invalid_argument");
    });
  }

  test("DeclareIncident validates its input", async () => {
    expect(
      (
        await rpcError(
          "DeclareIncident",
          { title: "", severity: "INCIDENT_SEVERITY_MAJOR" },
          owner,
        )
      ).code,
    ).toBe("invalid_argument");
    expect(
      (await rpcError("DeclareIncident", { title: "x" }, owner)).code,
    ).toBe("invalid_argument");
    expect(
      (
        await rpcError(
          "DeclareIncident",
          {
            title: "x",
            severity: "INCIDENT_SEVERITY_MAJOR",
            startedAt: "yesterday",
          },
          owner,
        )
      ).code,
    ).toBe("invalid_argument");
    expect(
      (
        await rpcError(
          "DeclareIncident",
          {
            title: "x",
            severity: "INCIDENT_SEVERITY_MAJOR",
            commanderEmail: "not-an-email",
          },
          owner,
        )
      ).code,
    ).toBe("invalid_argument");
  });
});

describe("IncidentService: lifecycle", () => {
  test("declare → note → mitigate → resolve → postmortem → approve and close", async () => {
    const id = await declare();
    const declared = await get(id);
    expect(declared.status).toBe(IncidentStatus.OPEN);
    expect(declared.severity).toBe(IncidentSeverity.MAJOR);
    expect(declared.commander).toBeUndefined();
    expect(declared.declaredBy?.email).toBe(ownerEmail);
    expect(declared.deletable).toBe(true);
    expect(declared.allowedTransitions).toEqual([
      IncidentStatus.MITIGATED,
      IncidentStatus.RESOLVED,
      IncidentStatus.CANCELED,
    ]);

    const note = await rpc(
      AddIncidentNoteResponseSchema,
      "AddIncidentNote",
      { id, message: "Rolled back the deploy" },
      owner,
    );
    expect(note.event?.type).toBe(IncidentEventType.NOTE);
    expect(note.event?.message).toBe("Rolled back the deploy");
    expect(note.event?.createdBy?.email).toBe(ownerEmail);

    const mitigated = await setStatus(id, "INCIDENT_STATUS_MITIGATED");
    expect(mitigated.incident?.status).toBe(IncidentStatus.MITIGATED);
    expect(mitigated.incident?.mitigatedAt).toBeDefined();
    expect(mitigated.incident?.deletable).toBe(false);
    expect(mitigated.incident?.events).toEqual([]);

    const resolved = await setStatus(
      id,
      "INCIDENT_STATUS_RESOLVED",
      owner,
      "All good",
    );
    expect(resolved.incident?.status).toBe(IncidentStatus.RESOLVED);
    expect(resolved.incident?.resolvedBy?.email).toBe(ownerEmail);

    const pm = await rpc(
      UpdatePostmortemResponseSchema,
      "UpdatePostmortem",
      { incidentId: id, content: "## Summary\nIt broke." },
      owner,
    );
    expect(pm.postmortem?.status).toBe(PostmortemStatus.DRAFT);
    expect(pm.postmortem?.draftedBy).toBe(PostmortemAuthor.USER);

    const approved = await rpc(
      ApprovePostmortemResponseSchema,
      "ApprovePostmortem",
      { incidentId: id, close: true },
      owner,
    );
    expect(approved.postmortem?.status).toBe(PostmortemStatus.APPROVED);
    expect(approved.postmortem?.approvedBy?.email).toBe(ownerEmail);
    expect(approved.incident?.closedAt).toBeDefined();
    expect(approved.incident?.allowedTransitions).toEqual([]);

    const err = await rpcError(
      "AddIncidentNote",
      { id, message: "late" },
      owner,
    );
    expect(err.code).toBe("failed_precondition");

    const full = await get(id);
    const types = full.events.map((e) => e.type);
    expect(types[0]).toBe(IncidentEventType.CLOSED);
    expect(types.at(-1)).toBe(IncidentEventType.DECLARED);
    expect(types).toContain(IncidentEventType.NOTE);
    expect(types).toContain(IncidentEventType.RESOLVED);
    const resolvedEvent = full.events.find(
      (e) => e.type === IncidentEventType.RESOLVED,
    );
    expect(resolvedEvent?.message).toContain("All good");
  });

  test("cancel closes the incident", async () => {
    const id = await declare();
    const canceled = await setStatus(id, "INCIDENT_STATUS_CANCELED");
    expect(canceled.incident?.status).toBe(IncidentStatus.CANCELED);
    expect(canceled.incident?.closedAt).toBeDefined();
    expect(canceled.incident?.allowedTransitions).toEqual([]);
  });

  test("the same status or a forbidden transition is failed_precondition", async () => {
    const id = await declare();
    expect(
      (
        await rpcError(
          "SetIncidentStatus",
          { id, status: "INCIDENT_STATUS_OPEN" },
          owner,
        )
      ).code,
    ).toBe("failed_precondition");
    await setStatus(id, "INCIDENT_STATUS_RESOLVED");
    expect(
      (
        await rpcError(
          "SetIncidentStatus",
          { id, status: "INCIDENT_STATUS_MITIGATED" },
          owner,
        )
      ).code,
    ).toBe("failed_precondition");
  });

  test("update edits fields and clears the summary", async () => {
    const id = await declare(owner, { summary: "first" });
    const updated = await rpc(
      UpdateIncidentResponseSchema,
      "UpdateIncident",
      {
        id,
        title: `${TEST_PREFIX} renamed`,
        severity: "INCIDENT_SEVERITY_CRITICAL",
        startedAt: "2026-01-01T00:00:00Z",
      },
      owner,
    );
    expect(updated.incident?.title).toBe(`${TEST_PREFIX} renamed`);
    expect(updated.incident?.severity).toBe(IncidentSeverity.CRITICAL);
    expect(updated.incident?.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(updated.incident?.summary).toBe("first");

    const cleared = await rpc(
      UpdateIncidentResponseSchema,
      "UpdateIncident",
      { id, clearSummary: true },
      owner,
    );
    expect(cleared.incident?.summary).toBeUndefined();
    expect(
      (
        await rpcError(
          "UpdateIncident",
          { id, summary: "x", clearSummary: true },
          owner,
        )
      ).code,
    ).toBe("invalid_argument");
  });
});

describe("IncidentService: commander", () => {
  test("declare assigns by email and emails the commander", async () => {
    const id = await declare(owner, { commanderEmail: memberEmail });
    expect((await get(id)).commander?.email).toBe(memberEmail);
    await settleBackgroundTasks();
    expect(incidentCommanderEmails).toHaveLength(1);
    expect(incidentCommanderEmails[0]?.to).toBe(memberEmail);
    expect(incidentCommanderEmails[0]?.url).toContain(`/incidents/${id}`);
  });

  test("no email when the commander is the key's creator", async () => {
    await declare(member, { commanderEmail: memberEmail });
    await settleBackgroundTasks();
    expect(incidentCommanderEmails).toHaveLength(0);
  });

  test("no commander, no email", async () => {
    const id = await declare();
    expect((await get(id)).commander).toBeUndefined();
    await settleBackgroundTasks();
    expect(incidentCommanderEmails).toHaveLength(0);
  });

  test("an email that is not a member is invalid_argument", async () => {
    const err = await rpcError(
      "DeclareIncident",
      {
        title: "x",
        severity: "INCIDENT_SEVERITY_MINOR",
        commanderEmail: "nobody@example.com",
      },
      owner,
    );
    expect(err.code).toBe("invalid_argument");
  });

  test("update reassigns and clears the commander", async () => {
    const id = await declare();
    const assigned = await rpc(
      UpdateIncidentResponseSchema,
      "UpdateIncident",
      { id, commanderEmail: adminEmail },
      owner,
    );
    expect(assigned.incident?.commander?.email).toBe(adminEmail);
    await settleBackgroundTasks();
    expect(incidentCommanderEmails.map((e) => e.to)).toEqual([adminEmail]);

    const cleared = await rpc(
      UpdateIncidentResponseSchema,
      "UpdateIncident",
      { id, clearCommander: true },
      owner,
    );
    expect(cleared.incident?.commander).toBeUndefined();
    expect(
      (
        await rpcError(
          "UpdateIncident",
          { id, commanderEmail: adminEmail, clearCommander: true },
          owner,
        )
      ).code,
    ).toBe("invalid_argument");
  });
});

describe("IncidentService: roles", () => {
  async function resolvedIncident(body: JsonObject = {}) {
    const id = await declare(owner, body);
    await setStatus(id, "INCIDENT_STATUS_RESOLVED");
    return id;
  }

  test("close needs an owner, an admin or the commander", async () => {
    const id = await resolvedIncident();
    expect(
      (await rpcError("CloseIncident", { id, skipPostmortem: true }, member))
        .code,
    ).toBe("permission_denied");
    expect(
      (
        await rpcError(
          "CloseIncident",
          { id, skipPostmortem: true },
          keyWithoutCreator,
        )
      ).code,
    ).toBe("permission_denied");
    const closed = await rpc(
      CloseIncidentResponseSchema,
      "CloseIncident",
      { id, skipPostmortem: true },
      admin,
    );
    expect(closed.incident?.closedAt).toBeDefined();

    const theirs = await resolvedIncident({ commanderEmail: memberEmail });
    const byCommander = await rpc(
      CloseIncidentResponseSchema,
      "CloseIncident",
      { id: theirs, skipPostmortem: true },
      member,
    );
    expect(byCommander.incident?.closedAt).toBeDefined();
  });

  test("close without an approved postmortem needs skip_postmortem", async () => {
    const id = await resolvedIncident();
    expect((await rpcError("CloseIncident", { id }, owner)).code).toBe(
      "failed_precondition",
    );
  });

  test("close from open is failed_precondition", async () => {
    const id = await declare();
    expect(
      (await rpcError("CloseIncident", { id, skipPostmortem: true }, owner))
        .code,
    ).toBe("failed_precondition");
  });

  test("delete needs an owner or admin, even for the commander", async () => {
    const id = await declare(owner, { commanderEmail: memberEmail });
    expect((await rpcError("DeleteIncident", { id }, member)).code).toBe(
      "permission_denied",
    );
    expect(
      (await rpcError("DeleteIncident", { id }, keyWithoutCreator)).code,
    ).toBe("permission_denied");
    const deleted = await rpc(
      DeleteIncidentResponseSchema,
      "DeleteIncident",
      { id },
      admin,
    );
    expect(deleted.success).toBe(true);
    expect((await rpcError("GetIncident", { id }, owner)).code).toBe(
      "not_found",
    );
  });

  test("delete after mitigation is failed_precondition", async () => {
    const id = await declare();
    await setStatus(id, "INCIDENT_STATUS_MITIGATED");
    expect((await rpcError("DeleteIncident", { id }, admin)).code).toBe(
      "failed_precondition",
    );
  });

  test("a key without a creator declares with no declarer", async () => {
    const id = await declare(keyWithoutCreator);
    expect((await get(id)).declaredBy).toBeUndefined();
  });
});

describe("IncidentService: postmortem", () => {
  test("is unset before anything is written", async () => {
    const id = await declare();
    const res = await rpc(
      GetPostmortemResponseSchema,
      "GetPostmortem",
      { incidentId: id },
      owner,
    );
    expect(res.postmortem).toBeUndefined();
  });

  test("can only be written once resolved", async () => {
    const id = await declare();
    const err = await rpcError(
      "UpdatePostmortem",
      { incidentId: id, content: "too early" },
      owner,
    );
    expect(err.code).toBe("failed_precondition");
  });

  test("approval needs a role and keeps the postmortem approved on edit", async () => {
    const id = await declare();
    await setStatus(id, "INCIDENT_STATUS_RESOLVED");
    await rpc(
      UpdatePostmortemResponseSchema,
      "UpdatePostmortem",
      { incidentId: id, content: "draft" },
      owner,
    );
    expect(
      (await rpcError("ApprovePostmortem", { incidentId: id }, member)).code,
    ).toBe("permission_denied");
    const approved = await rpc(
      ApprovePostmortemResponseSchema,
      "ApprovePostmortem",
      { incidentId: id },
      admin,
    );
    expect(approved.postmortem?.status).toBe(PostmortemStatus.APPROVED);
    expect(approved.incident?.closedAt).toBeUndefined();

    const edited = await rpc(
      UpdatePostmortemResponseSchema,
      "UpdatePostmortem",
      { incidentId: id, content: "final" },
      owner,
    );
    expect(edited.postmortem?.status).toBe(PostmortemStatus.APPROVED);
    expect(edited.postmortem?.content).toBe("final");
  });
});

describe("IncidentService: list", () => {
  test("filters by status and closed, and counts", async () => {
    const open = await declare();
    const resolved = await declare();
    await setStatus(resolved, "INCIDENT_STATUS_RESOLVED");
    const closed = await declare();
    await setStatus(closed, "INCIDENT_STATUS_RESOLVED");
    await rpc(
      CloseIncidentResponseSchema,
      "CloseIncident",
      { id: closed, skipPostmortem: true },
      owner,
    );

    const all = await rpc(
      ListIncidentsResponseSchema,
      "ListIncidents",
      { limit: 100 },
      owner,
    );
    const ids = all.incidents.map((i) => i.id);
    expect(ids.indexOf(open)).toBeLessThan(ids.indexOf(resolved));
    expect(all.totalSize).toBe(all.incidents.length);

    const page1 = await rpc(
      ListIncidentsResponseSchema,
      "ListIncidents",
      { limit: 1 },
      owner,
    );
    expect(page1.incidents).toHaveLength(1);
    expect(page1.totalSize).toBe(all.totalSize);

    const openOnly = await rpc(
      ListIncidentsResponseSchema,
      "ListIncidents",
      { statuses: ["INCIDENT_STATUS_OPEN"], limit: 100 },
      owner,
    );
    expect(
      openOnly.incidents.every((i) => i.status === IncidentStatus.OPEN),
    ).toBe(true);
    expect(openOnly.incidents.map((i) => i.id)).toContain(open);

    const needsPostmortem = await rpc(
      ListIncidentsResponseSchema,
      "ListIncidents",
      { statuses: ["INCIDENT_STATUS_RESOLVED"], closed: false, limit: 100 },
      owner,
    );
    const needsIds = needsPostmortem.incidents.map((i) => i.id);
    expect(needsIds).toContain(resolved);
    expect(needsIds).not.toContain(closed);

    const closedOnly = await rpc(
      ListIncidentsResponseSchema,
      "ListIncidents",
      { closed: true, limit: 100 },
      owner,
    );
    expect(closedOnly.incidents.map((i) => i.id)).toContain(closed);
    expect(closedOnly.incidents.every((i) => i.closedAt !== undefined)).toBe(
      true,
    );
  });

  test("rejects an out-of-range limit", async () => {
    expect((await rpcError("ListIncidents", { limit: 500 }, owner)).code).toBe(
      "invalid_argument",
    );
  });
});

describe("IncidentService: status report link", () => {
  test("link and unlink", async () => {
    const id = await declare();
    const report = await createReport(owner);
    const reportId = report.statusReport?.id ?? "";
    const linked = await rpc(
      LinkStatusReportResponseSchema,
      "LinkStatusReport",
      { id, statusReportId: reportId },
      owner,
    );
    expect(linked.incident?.statusReport?.id).toBe(reportId);
    expect(linked.incident?.statusReport?.pageId).toBe(String(pageId));

    const fromReport = await rpc(
      GetStatusReportResponseSchema,
      "GetStatusReport",
      { id: reportId },
      owner,
      STATUS_REPORT,
    );
    expect(fromReport.statusReport?.incidentId).toBe(id);

    const unlinked = await rpc(
      UnlinkStatusReportResponseSchema,
      "UnlinkStatusReport",
      { id },
      owner,
    );
    expect(unlinked.incident?.statusReport).toBeUndefined();
  });

  test("CreateStatusReport links an incident in the same step", async () => {
    const id = await declare();
    const report = await createReport(owner, id);
    expect(report.statusReport?.incidentId).toBe(id);
    expect((await get(id)).statusReport?.id).toBe(report.statusReport?.id);

    const list = await rpc(
      ListStatusReportsResponseSchema,
      "ListStatusReports",
      { limit: 100 },
      owner,
      STATUS_REPORT,
    );
    const summary = list.statusReports.find(
      (r) => r.id === report.statusReport?.id,
    );
    expect(summary?.incidentId).toBe(id);
  });

  test("CreateStatusReport for a closed incident fails and creates nothing", async () => {
    const id = await declare();
    await setStatus(id, "INCIDENT_STATUS_CANCELED");
    const before = await db
      .select({ id: statusReport.id })
      .from(statusReport)
      .where(eq(statusReport.workspaceId, workspaceId))
      .all();
    const err = await rpcError(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX} report`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "m",
        date: new Date().toISOString(),
        pageId: String(pageId),
        incidentId: id,
      },
      owner,
      STATUS_REPORT,
    );
    expect(err.code).toBe("failed_precondition");
    const after = await db
      .select({ id: statusReport.id })
      .from(statusReport)
      .where(eq(statusReport.workspaceId, workspaceId))
      .all();
    expect(after).toHaveLength(before.length);
  });

  test("a report already linked elsewhere is failed_precondition", async () => {
    const first = await declare();
    const report = await createReport(owner, first);
    const err = await rpcError(
      "DeclareIncident",
      {
        title: "x",
        severity: "INCIDENT_SEVERITY_MINOR",
        statusReportId: report.statusReport?.id ?? "",
      },
      owner,
    );
    expect(err.code).toBe("failed_precondition");
  });
});

describe("IncidentService: Slack", () => {
  test("no channel unless open_slack_channel is set", async () => {
    await declare();
    await settleBackgroundTasks();
    expect(slackCalls("conversations.create")).toHaveLength(0);
  });

  test("open_slack_channel creates and binds a channel", async () => {
    const id = await declare(owner, { openSlackChannel: true });
    await settleBackgroundTasks();
    expect(slackCalls("conversations.create")).toHaveLength(1);
    expect(slackCalls("pins.add")).toHaveLength(1);
    expect((await get(id)).slackChannelUrl).toBe(
      "https://slack.com/app_redirect?team=T_RPC&channel=C_INCIDENT",
    );
  });

  test("status changes announce in the bound channel and cancel archives it", async () => {
    const id = await declare();
    await bindChannel(id);
    await setStatus(id, "INCIDENT_STATUS_MITIGATED", owner, "rolled back");
    await settleBackgroundTasks();
    const posted = slackCalls("postMessage");
    expect(posted).toHaveLength(1);
    expect(String(posted[0]?.args.text)).toContain(
      "marked the incident *mitigated*",
    );
    expect(slackCalls("conversations.archive")).toHaveLength(0);

    await setStatus(id, "INCIDENT_STATUS_CANCELED");
    await settleBackgroundTasks();
    expect(slackCalls("conversations.archive")).toHaveLength(1);
  });

  test("close and delete archive the bound channel", async () => {
    const toClose = await declare();
    await bindChannel(toClose);
    await setStatus(toClose, "INCIDENT_STATUS_RESOLVED");
    await rpc(
      CloseIncidentResponseSchema,
      "CloseIncident",
      { id: toClose, skipPostmortem: true },
      owner,
    );
    await settleBackgroundTasks();
    expect(slackCalls("conversations.archive")).toHaveLength(1);

    slackTestState.calls = [];
    const toDelete = await declare();
    await db
      .update(incident)
      .set({ slackTeamId: "T_RPC", slackChannelId: "C_DELETE" })
      .where(eq(incident.id, Number(toDelete)));
    await rpc(
      DeleteIncidentResponseSchema,
      "DeleteIncident",
      { id: toDelete },
      owner,
    );
    await settleBackgroundTasks();
    const archived = slackCalls("conversations.archive");
    expect(archived).toHaveLength(1);
    expect(archived[0]?.args.channel).toBe("C_DELETE");
  });
});
