import { describe, expect, test } from "vitest";

import { nextStepBlocks } from "./next-steps";

function buttons(blocks: ReturnType<typeof nextStepBlocks>) {
  return (blocks ?? []).flatMap((b) =>
    b.type === "actions"
      ? b.elements.map((e) =>
          e.type === "button" ? { action: e.action_id, value: e.value } : {},
        )
      : [],
  );
}

describe("nextStepBlocks", () => {
  test("a declared incident: tell customers", () => {
    const blocks = nextStepBlocks("declare_incident", { id: 7 }, "Declared.");
    expect(JSON.stringify(blocks)).toContain("Next: tell customers.");
    expect(buttons(blocks)).toEqual([
      { action: "incident_card_status_page", value: "7" },
    ]);
  });

  test("a report created or updated: post an update or resolve", () => {
    const output = { statusReport: { id: 12, status: "investigating" } };
    for (const tool of ["create_status_report", "add_status_report_update"]) {
      const blocks = nextStepBlocks(tool, output, "Created.");
      expect(JSON.stringify(blocks)).toContain(
        "Next: post an update when you know more.",
      );
      expect(buttons(blocks)).toEqual([
        { action: "report_next_post_update", value: "12" },
        { action: "report_next_resolve", value: "12" },
      ]);
    }
  });

  test("nothing after a resolution or for other tools", () => {
    expect(
      nextStepBlocks(
        "add_status_report_update",
        { statusReport: { id: 12, status: "resolved" } },
        "Resolved.",
      ),
    ).toBeUndefined();
    expect(
      nextStepBlocks("create_maintenance", { id: 1 }, "x"),
    ).toBeUndefined();
    expect(
      nextStepBlocks("declare_incident", { ok: true }, "x"),
    ).toBeUndefined();
  });
});
