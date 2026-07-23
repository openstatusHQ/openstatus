import type {
  AnyAgentTool,
  ExtraFlag,
  SummaryLine,
} from "@openstatus/services/agent-tools";

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

/** Escape `& < >` so Slack renders them as literal mrkdwn text. */
function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape a string for use as Slack mrkdwn link text (`<url|text>`). */
function escapeLinkText(text: string): string {
  return escapeText(text).replace(/\|/g, "❘");
}

/**
 * Data resolvers the Slack surface injects so `buildConfirmationBlocks` can
 * turn `SummaryLineRef` descriptors into names. Resolution needs DB access,
 * which the edge-safe services layer that produces the refs must not do.
 */
export interface RefResolvers {
  /** Page id → dashboard link, or null when the page no longer exists. */
  page: (pageId: number) => Promise<{ title: string; url: string } | null>;
  /** Page-component ids → their names (missing ids simply absent). */
  componentNames: (ids: number[]) => Promise<Map<number, string>>;
}

async function renderLine(
  line: SummaryLine,
  resolvers?: RefResolvers,
): Promise<string> {
  const ref = line.ref;
  if (ref && resolvers) {
    try {
      switch (ref.kind) {
        case "page": {
          const link = await resolvers.page(ref.pageId);
          if (link) {
            return `*Page:* <${link.url}|${escapeLinkText(link.title)}>`;
          }
          break;
        }
        case "components": {
          const names = await resolvers.componentNames(ref.componentIds);
          const value = ref.componentIds
            .map((id) => nameOrId(names, id))
            .join(", ");
          return `*${line.label}:* ${value}`;
        }
        case "componentImpacts": {
          const names = await resolvers.componentNames(
            ref.impacts.map((i) => i.pageComponentId),
          );
          const value = ref.impacts
            .map((i) => `${nameOrId(names, i.pageComponentId)} → ${i.impact}`)
            .join(", ");
          return `*${line.label}:* ${value}`;
        }
      }
    } catch {
      // A transient name/link lookup failure degrades just this line to its
      // raw id value below, rather than aborting the whole confirmation card.
    }
  }
  return `*${line.label}:* ${escapeText(line.value)}`;
}

function nameOrId(names: Map<number, string>, id: number): string {
  const name = names.get(id);
  return name ? escapeText(name) : String(id);
}

/**
 * Build the Block Kit confirmation card from a tool's `approval.summarize()`.
 * Two affirmative buttons when an extraFlag exists; one otherwise. When a
 * summary line carries a `ref` and `resolvers` are supplied, raw ids are
 * replaced by entity names (a dashboard link for pages, component names for
 * component ids).
 */
export async function buildConfirmationBlocks(args: {
  actionId: string;
  tool: AnyAgentTool;
  input: unknown;
  resolvers?: RefResolvers;
}): Promise<Block[]> {
  const { actionId, tool, input, resolvers } = args;
  if (!tool.approval) {
    throw new Error(
      `slack blocks: tool "${tool.name}" has no approval metadata`,
    );
  }
  const summary = tool.approval.summarize(input);
  const flag: ExtraFlag | undefined = tool.approval.extraFlags?.[0];

  const lines = (
    await Promise.all(summary.lines.map((l) => renderLine(l, resolvers)))
  ).join("\n");

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
      text: {
        type: "mrkdwn",
        text: `*${escapeText(summary.title)}*\n\n${lines}`,
      },
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
  // Rendered as the message `text` field, which Slack parses as mrkdwn — escape
  // so an LLM/user-controlled title can't inject a link or other markup.
  return escapeText(args.tool.approval.summarize(args.input).title);
}
