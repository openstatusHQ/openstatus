import {
  type DescMessage,
  fromJson,
  type JsonObject,
  type JsonValue,
  type MessageShape,
} from "@bufbuild/protobuf";
import { db, eq } from "@openstatus/db";
import { playbook } from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import {
  DeletePlaybookResponseSchema,
  GetPlaybookResponseSchema,
  ListPlaybooksResponseSchema,
  UpdatePlaybookResponseSchema,
} from "@openstatus/proto/playbook/v1";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { app } from "../../../../../index";

const SERVICE = "openstatus.playbook.v1.PlaybookService";

type Auth = Record<string, string>;

function post(method: string, body: JsonObject, headers: Auth) {
  return app.request(`/rpc/${SERVICE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function rpc<T extends DescMessage>(
  schema: T,
  method: string,
  body: JsonObject,
  headers: Auth,
): Promise<MessageShape<T>> {
  const res = await post(method, body, headers);
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
): Promise<{ status: number; code: string }> {
  const res = await post(method, body, headers);
  const json: { code?: string } = await res.json();
  return { status: res.status, code: json.code ?? "" };
}

let workspaceId: number;
let otherWorkspaceId: number;
let key: Auth;
let otherKey: Auth;
const playbookIds = new Set<number>();

async function trackIds() {
  const rows = await db
    .select({ id: playbook.id })
    .from(playbook)
    .where(eq(playbook.workspaceId, workspaceId))
    .all();
  for (const row of rows) playbookIds.add(row.id);
}

beforeAll(async () => {
  workspaceId = (await createTestWorkspace({ plan: "team" })).workspace.id;
  otherWorkspaceId = (await createTestWorkspace({ plan: "team" })).workspace.id;
  key = { "x-openstatus-key": String(workspaceId) };
  otherKey = { "x-openstatus-key": String(otherWorkspaceId) };
});

afterAll(async () => {
  await db.delete(playbook).where(eq(playbook.workspaceId, workspaceId));
  await db.delete(playbook).where(eq(playbook.workspaceId, otherWorkspaceId));
  // audit rows outlive the playbook and would be inherited by a recycled id
  await clearAuditLogFor({
    entityType: "playbook",
    entityIds: [...playbookIds],
  });
});

describe("PlaybookService", () => {
  test("writes, reads, lists and deletes a playbook", async () => {
    const created = await rpc(
      UpdatePlaybookResponseSchema,
      "UpdatePlaybook",
      {
        slug: "status-page",
        content: "Sign off as {{team_name}}. Contact {{support}}.",
        variables: { team_name: "Platform", unused: "x" },
      },
      key,
    );
    await trackIds();
    expect(created.playbook?.slug).toBe("status-page");
    expect(created.playbook?.title).toBe("Status page");
    // only values the text uses are kept; the text keeps its variables
    expect(created.playbook?.variables).toEqual({ team_name: "Platform" });
    expect(created.playbook?.content).toContain("{{team_name}}");

    const replaced = await rpc(
      UpdatePlaybookResponseSchema,
      "UpdatePlaybook",
      {
        slug: "status-page",
        content: "No ETAs. Contact {{support}}.",
        variables: { support: "help@acme.com" },
      },
      key,
    );
    expect(replaced.playbook?.variables).toEqual({ support: "help@acme.com" });
    expect(replaced.playbook?.createdAt).toBe(created.playbook?.createdAt);

    const got = await rpc(
      GetPlaybookResponseSchema,
      "GetPlaybook",
      { slug: "status-page" },
      key,
    );
    expect(got.playbook?.content).toBe("No ETAs. Contact {{support}}.");

    const listed = await rpc(
      ListPlaybooksResponseSchema,
      "ListPlaybooks",
      {},
      key,
    );
    expect((listed.playbooks ?? []).map((p) => p.slug)).toEqual([
      "status-page",
    ]);

    const deleted = await rpc(
      DeletePlaybookResponseSchema,
      "DeletePlaybook",
      { slug: "status-page" },
      key,
    );
    expect(deleted.success).toBe(true);
    expect(await rpcError("GetPlaybook", { slug: "status-page" }, key)).toEqual(
      { status: 404, code: "not_found" },
    );
  });

  test("a playbook is not visible from another workspace", async () => {
    await rpc(
      UpdatePlaybookResponseSchema,
      "UpdatePlaybook",
      { slug: "postmortem", content: "## Summary" },
      key,
    );
    await trackIds();
    expect(
      await rpcError("GetPlaybook", { slug: "postmortem" }, otherKey),
    ).toEqual({ status: 404, code: "not_found" });
    const listed = await rpc(
      ListPlaybooksResponseSchema,
      "ListPlaybooks",
      {},
      otherKey,
    );
    expect(listed.playbooks ?? []).toEqual([]);
    expect(
      await rpcError("DeletePlaybook", { slug: "postmortem" }, otherKey),
    ).toEqual({ status: 404, code: "not_found" });
  });

  test("rejects a missing or malformed slug, empty content and a bad variable name", async () => {
    expect((await rpcError("GetPlaybook", {}, key)).code).toBe(
      "invalid_argument",
    );
    expect(
      (await rpcError("GetPlaybook", { slug: "Run_Book" }, key)).code,
    ).toBe("invalid_argument");
    expect(
      (
        await rpcError(
          "UpdatePlaybook",
          { slug: "postmortem", content: "" },
          key,
        )
      ).code,
    ).toBe("invalid_argument");
    expect(
      (
        await rpcError(
          "UpdatePlaybook",
          {
            slug: "postmortem",
            content: "x",
            variables: { "Team Name": "x" },
          },
          key,
        )
      ).code,
    ).toBe("invalid_argument");
  });

  test("a custom slug needs a title, then behaves like any playbook", async () => {
    expect(
      (
        await rpcError(
          "UpdatePlaybook",
          { slug: "database-failover", content: "x" },
          key,
        )
      ).code,
    ).toBe("invalid_argument");

    const created = await rpc(
      UpdatePlaybookResponseSchema,
      "UpdatePlaybook",
      {
        slug: "database-failover",
        title: "Database failover",
        description: "Read before touching the primary.",
        content: "Promote the replica.",
      },
      key,
    );
    await trackIds();
    expect(created.playbook?.title).toBe("Database failover");

    const listed = await rpc(
      ListPlaybooksResponseSchema,
      "ListPlaybooks",
      {},
      key,
    );
    expect((listed.playbooks ?? []).map((p) => p.slug)).toContain(
      "database-failover",
    );

    await rpc(
      DeletePlaybookResponseSchema,
      "DeletePlaybook",
      { slug: "database-failover" },
      key,
    );
    expect(
      await rpcError("GetPlaybook", { slug: "database-failover" }, key),
    ).toEqual({ status: 404, code: "not_found" });
  });

  test("requires credentials", async () => {
    expect((await rpcError("ListPlaybooks", {}, {})).code).toBe(
      "unauthenticated",
    );
  });
});
