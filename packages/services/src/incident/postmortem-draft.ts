import { asc, eq } from "@openstatus/db";
import {
  type IncidentEventType,
  type IncidentPostmortem,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import { displayName } from "../attribution";
import { type ServiceContext, getReadDb } from "../context";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { getSlackConnection } from "../integration/slack-connection";
import { getIncident } from "./list";
import { listIncidentEvents } from "./list-events";
import { draftPostmortem, getPostmortem } from "./postmortem";

type SlackPage = {
  ok?: boolean;
  messages?: {
    ts?: string;
    text?: string;
    user?: string;
    bot_id?: string;
    reply_count?: number;
  }[];
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
};

/** The Slack history calls the postmortem draft makes. `WebClient` fits. */
export type SlackHistoryClient = {
  conversations: {
    history(args: {
      channel: string;
      cursor?: string;
      limit?: number;
    }): Promise<SlackPage>;
    replies(args: {
      channel: string;
      ts: string;
      cursor?: string;
      limit?: number;
    }): Promise<SlackPage>;
  };
};

export type GenerateText = (args: {
  system: string;
  prompt: string;
}) => Promise<string>;

const MAX_MESSAGES = 500;
/**
 * Bounds what is summarized and stored; well under the 2,000,000 characters
 * `DraftPostmortemInput` accepts for `sourceTranscript`.
 */
const MAX_TRANSCRIPT_CHARS = 1_000_000;
/** Beyond this the transcript is summarized in windows before drafting. */
const TRANSCRIPT_BUDGET = 60_000;
const WINDOW = 40_000;

function line(message: { ts?: string; user?: string; text?: string }): string {
  const at = message.ts
    ? new Date(Number(message.ts.split(".")[0]) * 1000).toISOString()
    : "";
  return `[${at}] <@${message.user ?? "unknown"}>: ${message.text ?? ""}`;
}

/**
 * The channel, oldest first, bot messages left out and threads inlined under
 * their parent, capped at 500 messages and 1,000,000 characters. The caps drop
 * the oldest top-level messages first, each with its whole thread: the end of
 * an incident (mitigation, resolution) matters more than its start.
 */
export async function collectChannelTranscript(
  client: SlackHistoryClient,
  channel: string,
): Promise<{ text: string; truncated: boolean }> {
  const top: NonNullable<SlackPage["messages"]> = [];
  let cursor: string | undefined;
  let truncated = false;
  do {
    const page = await client.conversations.history({
      channel,
      cursor,
      limit: 200,
    });
    top.push(...(page.messages ?? []));
    cursor = page.has_more ? page.response_metadata?.next_cursor : undefined;
    if (top.length >= MAX_MESSAGES) {
      truncated = Boolean(cursor);
      break;
    }
  } while (cursor);

  // Walk newest first, one block (a parent and its thread) at a time, so the
  // caps drop the oldest blocks whole and never split a parent from its
  // replies. Only an oversized newest block is cut, keeping its parent and
  // its newest replies.
  const blocks: string[][] = [];
  let count = 0;
  for (const message of top) {
    const block: string[] = [];
    // An older block over the remaining budget is dropped whole, so stop
    // paging its thread early. Only the newest block needs every page, to
    // keep its newest replies.
    const overBudget = () =>
      blocks.length > 0 && count + block.length > MAX_MESSAGES;
    // A bot parent (the incident card) is left out, its human replies are not.
    if (!message.bot_id && message.text) block.push(line(message));
    if (message.reply_count && message.ts && !overBudget()) {
      let replyCursor: string | undefined;
      do {
        const thread = await client.conversations.replies({
          channel,
          ts: message.ts,
          cursor: replyCursor,
          limit: 200,
        });
        for (const reply of thread.messages ?? []) {
          if (reply.ts === message.ts || reply.bot_id || !reply.text) continue;
          block.push(`    ${line(reply)}`);
          if (overBudget()) break;
        }
        replyCursor = thread.has_more
          ? thread.response_metadata?.next_cursor
          : undefined;
      } while (replyCursor && !overBudget());
    }
    if (block.length === 0) continue;
    if (count + block.length > MAX_MESSAGES) {
      truncated = true;
      if (blocks.length === 0) blocks.push(keepNewest(block, MAX_MESSAGES));
      break;
    }
    blocks.push(block);
    count += block.length;
  }
  const ordered = blocks.reverse();
  const size = (block: string[]) =>
    block.reduce((sum, entry) => sum + entry.length + 1, 0);
  // Over the character cap, drop whole blocks from the oldest end.
  let length = ordered.reduce((sum, block) => sum + size(block), 0) - 1;
  while (length > MAX_TRANSCRIPT_CHARS && ordered.length > 1) {
    length -= size(ordered.shift() ?? []);
    truncated = true;
  }
  const lines = ordered.flat();
  // A single block still over the cap loses its oldest replies, then lines.
  while (length > MAX_TRANSCRIPT_CHARS && lines.length > 0) {
    const drop = lines.length > 1 && !lines[0].startsWith("    ") ? 1 : 0;
    length -= lines[drop].length + 1;
    lines.splice(drop, 1);
    truncated = true;
  }
  return { text: lines.join("\n"), truncated };
}

/** A block's parent (when it has one) plus its newest lines, `max` in all. */
function keepNewest(block: string[], max: number): string[] {
  const hasParent = !block[0].startsWith("    ");
  if (!hasParent) return block.slice(-max);
  return [block[0], ...block.slice(1).slice(-(max - 1))];
}

const SYSTEM = `You write blameless incident postmortems for an engineering team.
Write GitHub-flavored markdown with exactly these sections, in order:
## Summary
## Impact
## Timeline
## Root cause
## What went well
## What went wrong
## Action items
Use only the facts given. Where a section has no facts, say what is unknown instead of guessing. The timeline is a bullet list ("- HH:MM UTC - ...") of the key moments only (detection, escalation, decisions, mitigation, resolution); state the date once above the list when the incident spans one day, otherwise use "- YYYY-MM-DD HH:MM UTC - ...". Never mention internal IDs (Slack channel IDs, status report numbers). Action items are a checklist ("- [ ] ...") with an owner placeholder when none is known. No preamble, no closing remarks.`;

/** Events that record wiring, not what happened during the incident. */
const BOOKKEEPING = new Set<IncidentEventType>([
  "status_report_linked",
  "status_report_unlinked",
  "slack_channel_bound",
  "slack_channel_unbound",
  "postmortem_drafted",
  "postmortem_updated",
  "postmortem_approved",
  "closed",
]);

async function fitTranscript(
  transcript: string,
  generate: GenerateText,
): Promise<{ text: string; summarized: boolean }> {
  if (transcript.length <= TRANSCRIPT_BUDGET) {
    return { text: transcript, summarized: false };
  }
  const summaries: string[] = [];
  for (let i = 0; i < transcript.length; i += WINDOW) {
    summaries.push(
      await generate({
        system:
          "Summarize this excerpt of an incident channel as a list of timestamped facts: what was observed, decided and changed, and by whom. Keep every timestamp.",
        prompt: transcript.slice(i, i + WINDOW),
      }),
    );
  }
  return { text: summaries.join("\n"), summarized: true };
}

/**
 * The agent's postmortem: incident fields, timeline, public status-report
 * updates and, when the incident has a channel, its transcript. Stored as a
 * draft together with the transcript it was built from.
 */
export async function generatePostmortemDraft(args: {
  ctx: ServiceContext;
  incidentId: number;
  generate: GenerateText;
  slackFor?: (botToken: string) => SlackHistoryClient;
}): Promise<IncidentPostmortem> {
  const { ctx, incidentId, generate } = args;
  if (!ctx.workspace.limits["slack-agent"]) {
    throw new ForbiddenError("Agent drafting is not included in your plan");
  }
  const row = await getIncident({ ctx, input: { id: incidentId } });
  if (!row) throw new NotFoundError("incident", incidentId);
  // `draftPostmortem` enforces these too; checking first spares the model calls.
  if (row.status !== "resolved") {
    throw new ConflictError(
      `A postmortem needs a resolved incident; #${row.id} is ${row.status}`,
    );
  }
  const existing = await getPostmortem({ ctx, input: { id: incidentId } });
  if (existing?.status === "approved") {
    throw new ConflictError(
      "The postmortem is approved; edit it instead of redrafting",
    );
  }
  const events = await listIncidentEvents({ ctx, input: { id: incidentId } });
  const updates = row.statusReportId
    ? await getReadDb(ctx)
        .select()
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, row.statusReportId))
        .orderBy(asc(statusReportUpdate.date))
        .all()
    : [];

  let transcript: string | null = null;
  let transcriptNote = "The incident had no Slack channel.";
  if (row.slackChannelId && args.slackFor) {
    const connection = await getSlackConnection({ ctx });
    if (connection && connection.teamId === row.slackTeamId) {
      try {
        const collected = await collectChannelTranscript(
          args.slackFor(connection.botToken),
          row.slackChannelId,
        );
        transcript = collected.text;
        transcriptNote = collected.truncated
          ? "The channel history was too long and only part of it was read."
          : "The full channel history was available.";
      } catch {
        transcriptNote = "The channel history could not be read.";
      }
    } else {
      transcriptNote =
        "Slack is no longer connected; the channel was not read.";
    }
  }

  let channelSection = "";
  if (transcript) {
    const fitted = await fitTranscript(transcript, generate);
    if (fitted.summarized) {
      transcriptNote += " It was too long and was summarized in parts first.";
    }
    channelSection = `\n\nChannel ${fitted.summarized ? "summary" : "transcript"}:\n${fitted.text}`;
  }

  const timeline = [...events]
    .reverse()
    .filter((e) => !BOOKKEEPING.has(e.type))
    .map(
      (e) =>
        `[${e.createdAt.toISOString()}] ${e.type}${e.createdByUser ? ` by ${displayName(e.createdByUser)}` : ""}: ${e.message ?? ""}`,
    )
    .join("\n");
  const publicUpdates = updates
    .map((u) => `[${u.date.toISOString()}] ${u.status}: ${u.message}`)
    .join("\n");

  const prompt = `Incident: ${row.title}
Severity: ${row.severity}
Status: ${row.status}
Impact started: ${row.startedAt.toISOString()}
Declared: ${row.declaredAt.toISOString()}
Mitigated: ${row.mitigatedAt?.toISOString() ?? "never"}
Resolved: ${row.resolvedAt?.toISOString() ?? "not yet"}
Commander: ${row.commander ? displayName(row.commander) : "none"}
Summary: ${row.summary ?? "none"}

Timeline recorded in openstatus:
${timeline || "(empty)"}

Public status-report updates:
${publicUpdates || "(none)"}

Source note: ${transcriptNote}${channelSection}`;

  const body = await generate({ system: SYSTEM, prompt });
  const content = `${body.trim()}\n\n---\n_Drafted by the openstatus agent. ${transcriptNote}_`;
  return draftPostmortem({
    ctx,
    input: {
      id: incidentId,
      content,
      draftedBy: "agent",
      sourceTranscript: transcript,
    },
  });
}
