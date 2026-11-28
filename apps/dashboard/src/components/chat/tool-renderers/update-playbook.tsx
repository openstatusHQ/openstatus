import { playbookLineChanges } from "@openstatus/db/src/schema/playbooks/changes";
import {
  playbookVariableNames,
  playbookVariableValue,
} from "@openstatus/db/src/schema/playbooks/variables";
import type {
  AgentToolInput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges } from "./before-diff";

/** With `before`, the content row holds only the lines that change, so an edit deep in a long playbook is visible. */
export function updatePlaybookChanges(
  input: AgentToolInput<"update_playbook">,
  before?: ApprovalBefore,
): ChangeRow[] {
  if (!before) {
    return [
      { field: "slug", after: input.slug },
      ...fieldChanges(input, ["title", "description", "content"]),
      ...Object.entries(input.variables ?? {}).map(([name, value]) => ({
        field: name,
        after: value,
      })),
    ];
  }
  const rows = fieldChanges(input, ["title", "description"], before);
  const { removed, added } = playbookLineChanges(
    typeof before.values.content === "string" ? before.values.content : "",
    input.content,
  );
  if (removed.length || added.length) {
    rows.push({
      field: "content",
      ...(removed.length ? { before: removed.join("\n") } : {}),
      ...(added.length ? { after: added.join("\n") } : {}),
    });
  }
  const stored = storedVariables(before.values.variables);
  const used = playbookVariableNames(input.content);
  for (const name of new Set([...Object.keys(stored), ...used])) {
    const previous = playbookVariableValue(stored, name) ?? "";
    // the write replaces the values: one left out, or no longer used, is unset
    const next = used.includes(name)
      ? (playbookVariableValue(input.variables, name) ?? "")
      : "";
    if (previous === next) continue;
    rows.push({
      field: name,
      ...(previous ? { before: previous } : {}),
      ...(next ? { after: next } : {}),
    });
  }
  return rows;
}

function storedVariables(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
