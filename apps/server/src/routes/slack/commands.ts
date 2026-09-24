import { getLogger } from "@logtape/logtape";
import { ForbiddenError } from "@openstatus/services";
import {
  createSlackSubscriber,
  listSlackSubscribersForChannel,
  removeSlackSubscriber,
} from "@openstatus/services/page-subscriber";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import { z } from "zod";

import { runInBackground } from "./background";
import { resolvePageFromUrl } from "./resolve-page";
import { resolveWorkspace } from "./workspace-resolver";

const logger = getLogger("api-server");

const slashCommandSchema = z.object({
  text: z.string().optional().default(""),
  team_id: z.string(),
  channel_id: z.string(),
  channel_name: z.string().optional(),
  response_url: z.string().optional(),
});

type SlashCommand = z.infer<typeof slashCommandSchema>;

const HELP = [
  "*openstatus*",
  "• `/openstatus subscribe <status-page-url>` — subscribe this channel to a status page",
  "• `/openstatus unsubscribe <status-page-url>` — unsubscribe",
  "• `/openstatus subscriptions` — show this channel's subscriptions",
].join("\n");

function ephemeral(c: Context, text: string) {
  return c.json({ response_type: "ephemeral", text });
}

/** Deliver a reply after the ack, via the command's single-use response URL. */
async function respondLater(responseUrl: string, text: string): Promise<void> {
  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  });
  if (!res.ok) {
    logger.error("slack response_url delivery failed", {
      status: res.status,
      body: await res.text().catch(() => ""),
    });
  }
}

async function joinChannel(teamId: string, channelId: string): Promise<void> {
  try {
    const resolved = await resolveWorkspace(teamId);
    if (!resolved) return;
    const client = new WebClient(resolved.botToken);
    await client.conversations.join({ channel: channelId });
  } catch (error) {
    // Private channels can't be self-joined — the bot must be /invited.
    logger.warn("slack conversations.join failed", { error, channelId });
  }
}

export function handleSlackCommand(c: Context) {
  const parsed = slashCommandSchema.safeParse(c.get("slackBody"));
  if (!parsed.success) {
    return ephemeral(c, "Could not read the command.");
  }
  const command = parsed.data;
  const sub = subcommand(command);

  // `help` — and anything unrecognised, which falls through to it — needs no
  // I/O, so it is answered in the ack itself.
  if (sub !== "subscribe" && sub !== "unsubscribe" && sub !== "subscriptions") {
    return ephemeral(c, HELP);
  }

  // The rest resolve a page, write to the DB and call the Slack API, which can
  // outrun the 3s a slash command has to be acknowledged in. Ack now and
  // deliver the reply to `response_url` (valid for 30 minutes).
  const responseUrl = command.response_url;
  if (!responseUrl) {
    // Slack always sends one; without it there is nowhere to deliver a late
    // reply, so fall back to answering inline.
    return runCommand(command).then((text) => ephemeral(c, text));
  }

  runInBackground(
    `command ${sub}`,
    async () => {
      // The 200 above is the only other thing the user gets: without this the
      // command fails silently on their side.
      const text = await runCommand(command).catch((err: unknown) => {
        logger.error("slack command failed", {
          error: err,
          teamId: command.team_id,
          channelId: command.channel_id,
        });
        return ":x: Something went wrong. Please try again.";
      });
      await respondLater(responseUrl, text);
    },
    { teamId: command.team_id, channelId: command.channel_id },
  );

  return c.body(null, 200);
}

function subcommand(command: SlashCommand): string {
  const tokens = command.text.trim().split(/\s+/).filter(Boolean);
  return (tokens[0] ?? "help").toLowerCase();
}

function argument(command: SlashCommand): string | undefined {
  return command.text.trim().split(/\s+/).filter(Boolean)[1];
}

/** Runs the subcommand and returns the message to show the user. */
async function runCommand(command: SlashCommand): Promise<string> {
  const {
    team_id: teamId,
    channel_id: channelId,
    channel_name: channelName,
  } = command;
  const sub = subcommand(command);
  const arg = argument(command);

  if (sub === "subscribe") {
    if (!arg) {
      return "Usage: `/openstatus subscribe <status-page-url>`";
    }
    const page = await resolvePageFromUrl(arg);
    if (!page) {
      return `Couldn't find a status page at \`${arg}\`.`;
    }
    try {
      const result = await createSlackSubscriber({
        input: {
          pageId: page.id,
          teamId,
          channelId,
          channelName,
        },
      });
      await joinChannel(teamId, channelId);
      if (result.alreadySubscribed) {
        return `This channel is already subscribed to *${page.title}*.`;
      }
      return `📡 This channel is now subscribed to *${page.title}*. Incident updates will appear here.`;
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return `*${page.title}* isn't on a plan that supports subscribers.`;
      }
      logger.error("slack /openstatus subscribe failed", {
        error,
        teamId,
        channelId,
      });
      return "Something went wrong subscribing this channel.";
    }
  }

  if (sub === "unsubscribe") {
    if (!arg) {
      const subs = await listSlackSubscribersForChannel({
        input: { teamId, channelId },
      });
      if (subs.length === 0) {
        return "This channel isn't subscribed to any status page.";
      }
      if (subs.length === 1) {
        await removeSlackSubscriber({
          input: { pageId: subs[0].pageId, teamId, channelId },
        });
        return `Unsubscribed from *${subs[0].pageName}*.`;
      }
      const list = subs.map((s) => `• ${s.pageName}`).join("\n");
      return `This channel is subscribed to several pages — specify which:\n${list}\n\nUsage: \`/openstatus unsubscribe <status-page-url>\``;
    }
    const page = await resolvePageFromUrl(arg);
    if (!page) {
      return `Couldn't find a status page at \`${arg}\`.`;
    }
    const { removed } = await removeSlackSubscriber({
      input: { pageId: page.id, teamId, channelId },
    });
    return removed
      ? `Unsubscribed from *${page.title}*.`
      : `This channel wasn't subscribed to *${page.title}*.`;
  }

  const subs = await listSlackSubscribersForChannel({
    input: { teamId, channelId },
  });
  if (subs.length === 0) {
    return "This channel isn't subscribed to any status page.";
  }
  const list = subs.map((s) => `• *${s.pageName}*`).join("\n");
  return `This channel is subscribed to:\n${list}`;
}
