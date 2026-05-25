import type { AnyAgentTool, ExtraFlag } from "@openstatus/services/agent-tools";

interface TextObject {
  type: "plain_text" | "mrkdwn";
  text: string;
  emoji?: boolean;
}

interface SectionBlock {
  type: "section";
  text: TextObject;
}

interface ActionsBlock {
  type: "actions";
  elements: ButtonElement[];
}

interface DividerBlock {
  type: "divider";
}

interface ButtonElement {
  type: "button";
  text: TextObject;
  action_id: string;
  value?: string;
  style?: "primary" | "danger";
}

export type Block = SectionBlock | ActionsBlock | DividerBlock;

/**
 * Action-id encoding. We need to round-trip both the pending action's id
 * and (when the tool declares one) the user's extraFlag choice. The
 * scheme is `<action>_<actionId>` with two affirmative actions when an
 * extraFlag exists: `approve` (flag off) and `approve_flag` (flag on).
 */
export function approveActionId(actionId: string): string {
  return `approve_${actionId}`;
}
export function approveWithFlagActionId(actionId: string): string {
  return `approve_flag_${actionId}`;
}
export function cancelActionId(actionId: string): string {
  return `cancel_${actionId}`;
}

export type ParsedActionId =
  | { kind: "approve"; flag: false; pendingId: string }
  | { kind: "approve"; flag: true; pendingId: string }
  | { kind: "cancel"; pendingId: string };

export function parseActionId(actionId: string): ParsedActionId | undefined {
  // Legacy: cards rendered before the registry-runner deploy used
  // `approve_notify_<id>`. Map to flag=true so the carrier lookup at
  // least surfaces ":x: This action has expired" — without this branch
  // the click would be silently dropped, leaving the card stale-but-
  // interactive. Bounded by the 5-min TTL; safe to remove afterwards.
  if (actionId.startsWith("approve_notify_")) {
    return {
      kind: "approve",
      flag: true,
      pendingId: actionId.slice("approve_notify_".length),
    };
  }
  if (actionId.startsWith("approve_flag_")) {
    return {
      kind: "approve",
      flag: true,
      pendingId: actionId.slice("approve_flag_".length),
    };
  }
  if (actionId.startsWith("approve_")) {
    return {
      kind: "approve",
      flag: false,
      pendingId: actionId.slice("approve_".length),
    };
  }
  if (actionId.startsWith("cancel_")) {
    return {
      kind: "cancel",
      pendingId: actionId.slice("cancel_".length),
    };
  }
  return undefined;
}

/**
 * Build the Block Kit confirmation card from a tool's `approval.summarize()`.
 * Two affirmative buttons when an extraFlag exists; one otherwise.
 */
export function buildConfirmationBlocks(args: {
  actionId: string;
  tool: AnyAgentTool;
  input: unknown;
}): Block[] {
  const { actionId, tool, input } = args;
  if (!tool.approval) {
    throw new Error(
      `slack blocks: tool "${tool.name}" has no approval metadata`,
    );
  }
  const summary = tool.approval.summarize(input);
  const flag: ExtraFlag | undefined = tool.approval.extraFlags?.[0];

  const lines = summary.lines.map((l) => `*${l.label}:* ${l.value}`).join("\n");

  const buttons: ButtonElement[] = [
    {
      type: "button",
      text: { type: "plain_text", text: "Approve", emoji: true },
      action_id: approveActionId(actionId),
      style: "primary",
    },
  ];
  if (flag) {
    buttons.push({
      type: "button",
      text: {
        type: "plain_text",
        text: `Approve & ${flag.label}`,
        emoji: true,
      },
      action_id: approveWithFlagActionId(actionId),
      style: "primary",
    });
  }
  buttons.push({
    type: "button",
    text: { type: "plain_text", text: "Cancel", emoji: true },
    action_id: cancelActionId(actionId),
    style: "danger",
  });

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${summary.title}*\n\n${lines}` },
    },
    { type: "divider" },
    { type: "actions", elements: buttons },
  ];
}

export function getConfirmationText(args: {
  tool: AnyAgentTool;
  input: unknown;
}): string {
  if (!args.tool.approval) return `Confirm ${args.tool.name}`;
  return args.tool.approval.summarize(args.input).title;
}
