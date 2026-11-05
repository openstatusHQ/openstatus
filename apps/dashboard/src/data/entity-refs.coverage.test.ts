import { describe, expect, it } from "vitest";

import {
  entityKindList,
  entityKinds,
  fieldRefKind,
} from "./entity-refs.client";

// The tool registry validates env and opens a db client on import; mirror the
// services test script. Nothing here queries, so the URL is never dialled.
// Next types NODE_ENV as read-only; widen to assign the test defaults.
const env: Record<string, string | undefined> = process.env;
for (const [key, value] of [
  ["NODE_ENV", "test"],
  ["RESEND_API_KEY", "test-key"],
  ["DATABASE_URL", "http://127.0.0.1:0"],
] as const) {
  env[key] ||= value;
}
const { agentTools } = await import("@openstatus/services/agent-tools");
const { z } = await import("zod");

/** Id fields that are not entity refs, with the reason they stay text. */
const notEntityRefs: Record<string, string> = {
  actorId: "user; no member lookup yet",
  commanderId: "user; no member lookup yet",
  entityId: "polymorphic; rendered through auditEntityKind",
  eventId: "incident timeline event, lives inside the incident",
  groupId:
    "page component group; edited on the page's components list, no card",
  tagIds: "monitor tags; no card",
  initialUpdateId: "status report update, lives inside the report",
  statusReportUpdateId: "status report update, lives inside the report",
  logId: "response log in Tinybird, no card",
  slackChannelId: "external Slack id",
};

function propertyKeys(node: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) propertyKeys(item, keys);
  } else if (node && typeof node === "object") {
    if (
      "properties" in node &&
      node.properties &&
      typeof node.properties === "object"
    ) {
      for (const key of Object.keys(node.properties)) keys.add(key);
    }
    for (const value of Object.values(node)) propertyKeys(value, keys);
  }
  return keys;
}

function toolIdFields(): string[] {
  const keys = new Set<string>();
  for (const tool of Object.values(agentTools)) {
    for (const [schema, io] of [
      [tool.inputSchema, "input"],
      [tool.outputSchema, "output"],
    ] as const) {
      propertyKeys(
        z.toJSONSchema(schema, { unrepresentable: "any", io }),
        keys,
      );
    }
  }
  return [...keys].filter((key) => /.Ids?$/.test(key)).sort();
}

describe("entity ref coverage", () => {
  it("maps every agent-tool id field to a kind or lists why it stays text", () => {
    const unmapped = toolIdFields().filter(
      (field) => !fieldRefKind(field) && !(field in notEntityRefs),
    );
    expect(unmapped).toEqual([]);
  });

  it("keeps the ignore list honest", () => {
    const fields = new Set(toolIdFields());
    for (const field of Object.keys(notEntityRefs)) {
      expect({ field, mapped: fieldRefKind(field) }).toEqual({
        field,
        mapped: undefined,
      });
      expect({ field, inSchemas: fields.has(field) }).toEqual({
        field,
        inSchemas: true,
      });
    }
  });

  it("claims each field and audit type for one kind only", () => {
    const fields = entityKindList.flatMap((kind) => entityKinds[kind].fields);
    expect(new Set(fields).size).toBe(fields.length);
    const auditTypes = entityKindList.map(
      (kind) => entityKinds[kind].auditType,
    );
    expect(new Set(auditTypes).size).toBe(auditTypes.length);
  });
});
