import type {
  AnyAgentTool,
  ExtraFlag,
  SummaryLine,
} from "@openstatus/services/agent-tools";

import { toMrkdwn } from "./mrkdwn";

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

interface ContextBlock {
  type: "context";
  elements: TextObject[];
}

/**
 * Renders standard markdown — the dialect the model actually writes — rather
 * than Slack's mrkdwn, so tables, ordered lists and fenced code survive
 * instead of being flattened by `toMrkdwn`.
 */
interface MarkdownBlock {
  type: "markdown";
  text: string;
}

interface ButtonElement {
  type: "button";
  text: TextObject;
  action_id: string;
  value?: string;
  style?: "primary" | "danger";
}

export type Block =
  | SectionBlock
  | ActionsBlock
  | DividerBlock
  | ContextBlock
  | MarkdownBlock;

/** Slack caps all `markdown` blocks in one payload at 12,000 characters. */
const MARKDOWN_BLOCK_LIMIT = 12_000;

/**
 * The agent's free-text answer as a Slack message. `text` carries the
 * mrkdwn-converted copy — it is what notifications and screen readers use, and
 * the fallback when the answer is too long for a `markdown` block.
 */
export function buildAnswerMessage(text: string): {
  text: string;
  blocks?: Block[];
} {
  const fallback = toMrkdwn(text);
  if (!text.trim() || text.length > MARKDOWN_BLOCK_LIMIT) {
    return { text: fallback };
  }
  return { text: fallback, blocks: [{ type: "markdown", text }] };
}

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

/** Escape a URL for use as the target of a Slack mrkdwn link (`<url|text>`). */
function escapeLinkUrl(url: string): string {
  return escapeText(url).replace(/\|/g, "%7C");
}

/**
 * Data resolvers the Slack surface injects so `buildConfirmationBlocks` can
 * turn `SummaryLineRef` descriptors into names. Resolution needs DB access,
 * which the edge-safe services layer that produces the refs must not do.
 */
export interface RefResolvers {
  /** Page id → dashboard link, or null when the page no longer exists. */
  page: (pageId: number) => Promise<{ title: string; url: string } | null>;
  /**
   * Status report id → its title and public URL (url null when its page is
   * gone), or null when the report doesn't exist in the workspace.
   */
  statusReport?: (
    statusReportId: number,
  ) => Promise<{ title: string; url: string | null } | null>;
  /** Page-component ids → their names (missing ids simply absent). */
  componentNames: (ids: number[]) => Promise<Map<number, string>>;
}

// Internal ids mean nothing to the person approving, so the card never shows
// one: id-only lines (e.g. "Report ID") are dropped, a page that can't be
// named is dropped, and a component that can't be named shows as unknown.
const ID_LABEL = /\bID$/i;
const UNKNOWN = "_unknown_";

async function renderLine(
  line: SummaryLine,
  resolvers?: RefResolvers,
): Promise<string | null> {
  const ref = line.ref;
  if (!ref) {
    return ID_LABEL.test(line.label)
      ? null
      : `*${line.label}:* ${escapeText(line.value)}`;
  }
  if (!resolvers) return null;
  try {
    switch (ref.kind) {
      case "page": {
        const link = await resolvers.page(ref.pageId);
        return link
          ? `*Page:* <${link.url}|${escapeLinkText(link.title)}>`
          : null;
      }
      case "components": {
        const names = await resolvers.componentNames(ref.componentIds);
        const value = ref.componentIds
          .map((id) => nameOrUnknown(names, id))
          .join(", ");
        return `*${line.label}:* ${value}`;
      }
      case "componentImpacts": {
        const names = await resolvers.componentNames(
          ref.impacts.map((i) => i.pageComponentId),
        );
        const value = ref.impacts
          .map(
            (i) => `${nameOrUnknown(names, i.pageComponentId)} → ${i.impact}`,
          )
          .join(", ");
        return `*${line.label}:* ${value}`;
      }
    }
  } catch {
    // A transient lookup failure drops just this line, rather than aborting
    // the whole confirmation card.
  }
  return null;
}

function nameOrUnknown(names: Map<number, string>, id: number): string {
  const name = names.get(id);
  return name ? escapeText(name) : UNKNOWN;
}

/**
 * The report a draft acts on (add update / update / resolve), found by its
 * `statusReportId` input. The services summary only carries the id — which
 * the card never shows — so Slack looks the title up itself.
 */
async function resolveReport(
  input: unknown,
  resolvers?: RefResolvers,
): Promise<{ title: string; url: string | null } | null> {
  if (!resolvers?.statusReport) return null;
  if (typeof input !== "object" || input === null) return null;
  const id = (input as { statusReportId?: unknown }).statusReportId;
  if (typeof id !== "number") return null;
  try {
    return await resolvers.statusReport(id);
  } catch {
    // Same as a failed ref lookup: drop the line, keep the card.
    return null;
  }
}

/**
 * Build the Block Kit confirmation card from a tool's `approval.summarize()`.
 * Two affirmative buttons when an extraFlag exists; one otherwise. When a
 * summary line carries a `ref` and `resolvers` are supplied, raw ids are
 * replaced by entity names (a dashboard link for pages, component names for
 * component ids). The card never shows a raw id.
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

  const report = await resolveReport(input, resolvers);
  const lines = [
    report ? `*Report:* ${escapeText(report.title)}` : null,
    ...(await Promise.all(summary.lines.map((l) => renderLine(l, resolvers)))),
  ]
    .filter((l) => l !== null)
    .join("\n");

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

  const blocks: Block[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${escapeText(summary.title)}*\n\n${lines}`,
      },
    },
  ];
  if (report?.url) {
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `<${escapeLinkUrl(report.url)}|View report>` },
      ],
    });
  }
  blocks.push({ type: "divider" }, { type: "actions", elements: buttons });
  return blocks;
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
