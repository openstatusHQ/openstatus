import { redis } from "@openstatus/upstash";
import { z } from "zod";

import { getClientIP, ratelimit } from "@/lib/ratelimit";
import { hashIP } from "@/lib/utils";

export const runtime = "edge";

const RATE_LIMIT_WINDOW = 60; // seconds
const MAX_REQUESTS_PER_WINDOW = 5;

// a docs pathname (from usePathname); constrained so it can't craft arbitrary Redis keys
const path = z
  .string()
  .min(1)
  .max(512)
  .regex(/^\/[a-zA-Z0-9/_-]*$/);

// rating-only (thumbs) and message-only (feedback) are separate actions
const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rating"),
    path,
    rating: z.enum(["up", "down"]),
  }),
  z.object({
    kind: z.literal("message"),
    path,
    message: z.string().trim().min(1).max(2000),
  }),
]);

type Rating = "up" | "down";

const countsKey = (path: string) => `docs-feedback:counts:${path}`;
const voterKey = (path: string, id: string) =>
  `docs-feedback:voter:${path}:${id}`;
// bound voter-key storage; after expiry a re-vote may double count (acceptable)
const VOTER_TTL = 60 * 60 * 24 * 180; // 180 days, seconds

// Slack mrkdwn treats & < > as control chars; escape user text before interpolation
const escapeSlack = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(request: Request) {
  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const clientIP = getClientIP(request.headers);
  if (!clientIP) {
    return Response.json(
      { error: "Unable to determine client IP" },
      { status: 400 },
    );
  }
  const voterId = await hashIP(clientIP);

  const limit = await ratelimit(`docs-feedback:${voterId}`, {
    window: RATE_LIMIT_WINDOW,
    limit: MAX_REQUESTS_PER_WINDOW,
  });
  if (!limit.success) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            (limit.reset - Date.now()) / 1000,
          ).toString(),
        },
      },
    );
  }

  // dev: skip external writes (Redis tally + Slack) so local runs don't pollute prod
  if (process.env.NODE_ENV === "development") {
    console.log("docs feedback", data);
    return Response.json({ success: true });
  }

  // historical tally of up/down votes per path; best-effort, never blocks Slack
  if (data.kind === "rating") {
    try {
      // one vote per (path, voter); SET ... GET atomically claims the new vote and
      // returns the prior one in a single round-trip, so concurrent requests can't
      // both read a stale value and double-count. The delta derives from that prior
      // value server-side, so a tampered count needs both a real prior vote and the IP.
      const previous = (await redis.set(
        voterKey(data.path, voterId),
        data.rating,
        { ex: VOTER_TTL, get: true },
      )) as Rating | null;
      if (previous !== data.rating) {
        await redis.hincrby(countsKey(data.path), data.rating, 1);
        if (previous) {
          await redis.hincrby(countsKey(data.path), previous, -1);
        }
      }
    } catch (err) {
      console.error("Docs feedback: failed to record vote", err);
    }
  }

  const webhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (!webhook) {
    console.error("Docs feedback: SLACK_FEEDBACK_WEBHOOK_URL not configured.");
    return Response.json({ success: true });
  }

  const lines = [
    data.kind === "rating"
      ? `*Docs feedback:* ${data.rating === "up" ? "👍 helpful" : "👎 not helpful"}`
      : "*Docs feedback:* 💬 comment",
    `*Path:* ${escapeSlack(data.path)}`,
  ];
  if (data.kind === "message") {
    lines.push(
      "--------------------------------",
      `*Message:* ${escapeSlack(data.message)}`,
    );
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
    if (!response.ok) {
      console.error(
        `Docs feedback: Slack webhook responded ${response.status}`,
      );
    }
  } catch (err) {
    console.error("Docs feedback: failed to post to Slack", err);
  }

  return Response.json({ success: true });
}
