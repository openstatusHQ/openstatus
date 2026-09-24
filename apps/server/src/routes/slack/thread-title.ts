import { getLogger } from "@logtape/logtape";
import type { WebClient } from "@slack/web-api";

import { redis } from "@/libs/clients";

const logger = getLogger("api-server");

// Slack accepts 200 characters, but the Messages tab shows far fewer before
// it elides — a title that only reads in full on hover isn't doing its job.
const MAX_TITLE = 60;

/**
 * Presence means the thread's title is settled: either we set it on the first
 * turn that produced a subject, or a person renamed it by hand. Both mean the
 * same thing here — leave it alone. A thread is one incident's whole life, so
 * the name should be its subject, not whatever the latest turn happened to do.
 *
 * The TTL outlives any incident by a wide margin; if it ever does lapse, the
 * cost is one stale thread getting re-titled on a much later turn.
 */
const TITLE_PREFIX = "slack:title:";
const TITLE_TTL_SECONDS = 30 * 24 * 60 * 60;

function titleKey(channel: string, threadTs: string): string {
  return `${TITLE_PREFIX}${channel}:${threadTs}`;
}

export async function isThreadTitled(
  channel: string,
  threadTs: string,
): Promise<boolean> {
  return (await redis.get(titleKey(channel, threadTs))) !== null;
}

export async function markThreadTitled(
  channel: string,
  threadTs: string,
): Promise<void> {
  await redis.set(titleKey(channel, threadTs), "1", {
    ex: TITLE_TTL_SECONDS,
  });
}

/** Cuts on a word boundary, falling back to a hard cut for one long word. */
export function truncateTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_TITLE) return clean;
  const cut = clean.slice(0, MAX_TITLE);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > MAX_TITLE / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}

export interface TitleSources {
  /** The write this turn proposed, if any. */
  draft?: { toolName: string; input: unknown };
  /** Title of the report the draft acts on, for updates and resolutions. */
  reportTitle?: string;
  /** What the user said, mention included — it gets stripped here. */
  userText?: string;
}

/**
 * The thread's subject, best source first:
 *
 * 1. a drafted report or maintenance title — already written for people to
 *    read, since it is what lands on the status page;
 * 2. the title of the report an update or resolution acts on;
 * 3. what the user asked, for turns that produce nothing else.
 *
 * Undefined when none of those yield anything: Slack's own default name beats
 * a title we made up.
 */
export function buildThreadTitle({
  draft,
  reportTitle,
  userText,
}: TitleSources): string | undefined {
  const drafted = draft && draftTitle(draft);
  if (drafted) return truncateTitle(drafted);
  if (reportTitle?.trim()) return truncateTitle(reportTitle);
  const asked = strippedUserText(userText);
  return asked ? truncateTitle(asked) : undefined;
}

function draftTitle(draft: {
  toolName: string;
  input: unknown;
}): string | undefined {
  if (typeof draft.input !== "object" || draft.input === null) return undefined;
  const title = (draft.input as { title?: unknown }).title;
  if (typeof title !== "string" || !title.trim()) return undefined;
  // Planned work reads as an outage in a timeline unless it says otherwise.
  return draft.toolName === "create_maintenance"
    ? `Maintenance: ${title}`
    : title;
}

function strippedUserText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const stripped = text
    .replace(/<@[A-Z0-9]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || undefined;
}

/**
 * Names the thread, once. Two turns racing here would both rename to the same
 * subject, so the check-then-set is left unguarded.
 */
export async function renameThread(args: {
  slack: WebClient;
  channel: string;
  threadTs: string;
  title: string;
  teamId: string;
}): Promise<void> {
  const { slack, channel, threadTs, title, teamId } = args;
  try {
    await slack.agents.sessions.rename({
      channel_id: channel,
      thread_ts: threadTs,
      title,
    });
  } catch (err) {
    // Workspaces without agent sessions throw here; the thread simply keeps
    // the name Slack gives it.
    logger.info("slack could not rename the thread", {
      error: err,
      channel,
      teamId,
    });
    return;
  }
  await markThreadTitled(channel, threadTs);
  logger.info("slack thread titled", { channel, threadTs, teamId, title });
}
