import type { AnyAgentTool } from "@openstatus/services/agent-tools";

const VERB_PREFIXES: Array<[string, string]> = [
  ["create_", "created"],
  ["update_", "updated"],
  ["resolve_", "resolved"],
  ["add_", "added"],
];

function inferVerb(toolName: string): string {
  const match = VERB_PREFIXES.find(([prefix]) => toolName.startsWith(prefix));
  return match?.[1] ?? "done";
}

/**
 * Fallback presenter. Uses `approval.summarize().title` for the headline
 * and `approval.verb` (or an inference from the tool name) for the verb.
 */
export function defaultPresenter(args: {
  tool: AnyAgentTool;
  input: unknown;
  notify: boolean;
}): string {
  if (!args.tool.approval) return ":white_check_mark: Done.";
  const summary = args.tool.approval.summarize(args.input);
  const verb = args.tool.approval.verb ?? inferVerb(args.tool.name);
  const notifyTail = args.notify ? " Subscribers notified." : "";
  return `:white_check_mark: ${summary.title} ${verb}.${notifyTail}`;
}
