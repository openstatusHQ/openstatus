/**
 * Eval cases — natural-language prompts paired with the tool we expect
 * the LLM to select. Used by `run.ts` to drive an LLM and assert the
 * chosen tool name.
 *
 * Stays small on purpose. ~12 cases is enough to catch obvious
 * description-language regressions; full coverage belongs in the unit
 * tests, not here.
 */

export type EvalCase = {
  /** Short identifier shown in eval output. */
  id: string;
  /** What the user types to the assistant. */
  prompt: string;
  /** Tool the LLM is expected to call. */
  expectedTool: string;
  /** If set, the chosen tool's `arguments` must include each listed key. */
  requiredArgs?: string[];
  /**
   * If set, the chosen tool's `arguments` must NOT include any of these
   * — used to guard against the "MUST call list_status_pages first"
   * rule (the LLM should call the list tool *first*, not pass a guessed
   * pageId straight into create_status_report).
   */
  forbiddenArgs?: string[];
};

export const cases: EvalCase[] = [
  // Tool-selection: list reads
  {
    id: "select.list_pages",
    prompt: "Show me our public status pages.",
    expectedTool: "list_status_pages",
  },
  {
    id: "select.list_active_reports",
    prompt: "Are there any open incidents right now?",
    expectedTool: "list_status_reports",
    requiredArgs: ["filter"],
  },
  {
    id: "select.list_all_reports",
    prompt:
      "Give me every status report we've ever published, including resolved ones.",
    expectedTool: "list_status_reports",
  },
  {
    id: "select.list_maintenances",
    prompt: "What maintenance windows do we have scheduled?",
    expectedTool: "list_maintenances",
  },

  // Prereq compliance: must call list_status_pages first when creating
  {
    id: "prereq.create_report_lists_pages_first",
    prompt:
      "Create a status report saying our payment gateway is down — investigating.",
    expectedTool: "list_status_pages",
  },
  {
    id: "prereq.create_maintenance_lists_pages_first",
    prompt:
      "Schedule a maintenance window on our main status page tomorrow 14:00-15:00 UTC for database upgrade.",
    expectedTool: "list_status_pages",
  },

  // Tool-selection: mutation verbs
  {
    id: "select.add_update",
    prompt:
      "Post a progress update to status report 42 saying we identified the root cause.",
    expectedTool: "add_status_report_update",
    requiredArgs: ["statusReportId", "status", "message"],
  },
  {
    id: "select.resolve",
    prompt: "Mark status report 42 as resolved — the issue has been fixed.",
    expectedTool: "resolve_status_report",
    requiredArgs: ["statusReportId", "message"],
  },
  {
    id: "select.update_metadata",
    prompt: 'Rename status report 42 to "Payments outage — May 1".',
    expectedTool: "update_status_report",
    requiredArgs: ["statusReportId", "title"],
  },

  // Param extraction
  {
    id: "params.add_update_status",
    prompt: "Add an update to report 17: we're now monitoring after the fix.",
    expectedTool: "add_status_report_update",
    requiredArgs: ["statusReportId", "status", "message"],
  },
  {
    id: "params.resolve_message",
    prompt:
      "Resolve incident 99 and tell users that the rate limiter has been disabled.",
    expectedTool: "resolve_status_report",
    requiredArgs: ["statusReportId", "message"],
  },

  // Edge — disambiguation
  {
    id: "select.update_vs_add_update",
    prompt:
      'Edit the title of status report 7 to "Investigating slow queries" — do not post a new public update.',
    expectedTool: "update_status_report",
  },
];
