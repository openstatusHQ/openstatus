import { ForbiddenError } from "@openstatus/services";
import {
  createSlackSubscriber,
  listSlackSubscribersForChannel,
  removeSlackSubscriber,
} from "@openstatus/services/page-subscriber";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import { z } from "zod";

import { resolvePageFromUrl } from "./resolve-page";
import { resolveWorkspace } from "./workspace-resolver";

const slashCommandSchema = z.object({
  text: z.string().optional().default(""),
  team_id: z.string(),
  channel_id: z.string(),
  channel_name: z.string().optional(),
});

const HELP = [
  "*OpenStatus*",
  "• `/openstatus add <status-page-url>` — subscribe this channel to a status page",
  "• `/openstatus remove <status-page-url>` — unsubscribe",
  "• `/openstatus list` — show this channel's subscriptions",
].join("\n");

function ephemeral(c: Context, text: string) {
  return c.json({ response_type: "ephemeral", text });
}

async function joinChannel(teamId: string, channelId: string): Promise<void> {
  try {
    const resolved = await resolveWorkspace(teamId);
    if (!resolved) return;
    const client = new WebClient(resolved.botToken);
    await client.conversations.join({ channel: channelId });
  } catch (error) {
    // Private channels can't be self-joined — the bot must be /invited.
    if (error instanceof Error) {
      console.error(
        `slack: conversations.join failed for ${channelId}: ${error.message}`,
      );
    }
  }
}

export async function handleSlackCommand(c: Context) {
  const parsed = slashCommandSchema.safeParse(c.get("slackBody"));
  if (!parsed.success) {
    return ephemeral(c, "Could not read the command.");
  }
  const { text, team_id, channel_id, channel_name } = parsed.data;

  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const sub = (tokens[0] ?? "help").toLowerCase();
  const arg = tokens[1];

  if (sub === "add") {
    if (!arg) {
      return ephemeral(c, "Usage: `/openstatus add <status-page-url>`");
    }
    const page = await resolvePageFromUrl(arg);
    if (!page) {
      return ephemeral(c, `Couldn't find a status page at \`${arg}\`.`);
    }
    try {
      const result = await createSlackSubscriber({
        input: {
          pageId: page.id,
          teamId: team_id,
          channelId: channel_id,
          channelName: channel_name,
        },
      });
      await joinChannel(team_id, channel_id);
      if (result.alreadySubscribed) {
        return ephemeral(
          c,
          `This channel is already subscribed to *${page.title}*.`,
        );
      }
      return ephemeral(
        c,
        `📡 This channel is now subscribed to *${page.title}*. Incident updates will appear here.`,
      );
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return ephemeral(
          c,
          `*${page.title}* isn't on a plan that supports subscribers.`,
        );
      }
      console.error("slack /openstatus add failed:", error);
      return ephemeral(c, "Something went wrong subscribing this channel.");
    }
  }

  if (sub === "remove") {
    if (!arg) {
      const subs = await listSlackSubscribersForChannel({
        input: { channelId: channel_id },
      });
      if (subs.length === 0) {
        return ephemeral(
          c,
          "This channel isn't subscribed to any status page.",
        );
      }
      if (subs.length === 1) {
        await removeSlackSubscriber({
          input: { pageId: subs[0].pageId, channelId: channel_id },
        });
        return ephemeral(c, `Unsubscribed from *${subs[0].pageName}*.`);
      }
      const list = subs.map((s) => `• ${s.pageName}`).join("\n");
      return ephemeral(
        c,
        `This channel is subscribed to several pages — specify which:\n${list}\n\nUsage: \`/openstatus remove <status-page-url>\``,
      );
    }
    const page = await resolvePageFromUrl(arg);
    if (!page) {
      return ephemeral(c, `Couldn't find a status page at \`${arg}\`.`);
    }
    const { removed } = await removeSlackSubscriber({
      input: { pageId: page.id, channelId: channel_id },
    });
    return ephemeral(
      c,
      removed
        ? `Unsubscribed from *${page.title}*.`
        : `This channel wasn't subscribed to *${page.title}*.`,
    );
  }

  if (sub === "list") {
    const subs = await listSlackSubscribersForChannel({
      input: { channelId: channel_id },
    });
    if (subs.length === 0) {
      return ephemeral(c, "This channel isn't subscribed to any status page.");
    }
    const list = subs.map((s) => `• *${s.pageName}*`).join("\n");
    return ephemeral(c, `This channel is subscribed to:\n${list}`);
  }

  return ephemeral(c, HELP);
}
