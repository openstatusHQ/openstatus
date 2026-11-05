import { getLogger } from "@logtape/logtape";
import { createMiddleware } from "hono/factory";

import type { SlackEnv } from "./config";

const logger = getLogger("api-server");

// Slack retries on a 401 and then disables the subscription, so a secret that
// doesn't match the app looks like "the bot never answers" — make it loud.
function logInvalidSignature(path: string) {
  logger.warn(
    "slack request rejected: invalid signature — does SLACK_SIGNING_SECRET belong to this Slack app?",
    { path },
  );
}

export const verifySlackSignature = createMiddleware<SlackEnv>(
  async (c, next) => {
    const signingSecret = c.get("slackConfig")?.signingSecret;

    if (!signingSecret) {
      logger.error("slack request rejected: signing secret not configured", {
        path: c.req.path,
      });
      return c.json({ error: "Slack not configured" }, 503);
    }

    const timestamp = c.req.header("x-slack-request-timestamp");
    const signature = c.req.header("x-slack-signature");

    if (!timestamp || !signature) {
      return c.json({ error: "Missing Slack headers" }, 401);
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) {
      logger.warn("slack request rejected: stale timestamp", {
        path: c.req.path,
        skewSeconds: now - Number(timestamp),
      });
      return c.json({ error: "Request too old" }, 401);
    }

    const rawBody = await c.req.text();

    const encoder = new TextEncoder();
    const basestring = `v0:${timestamp}:${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(basestring),
    );
    const computed = `v0=${Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;

    if (computed.length !== signature.length) {
      logInvalidSignature(c.req.path);
      return c.json({ error: "Invalid signature" }, 401);
    }

    const a = encoder.encode(computed);
    const b = encoder.encode(signature);
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a[i] ^ b[i];
    }
    if (mismatch !== 0) {
      logInvalidSignature(c.req.path);
      return c.json({ error: "Invalid signature" }, 401);
    }

    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("application/json")) {
      c.set("slackBody", JSON.parse(rawBody));
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      const payload = params.get("payload");
      // Interactions arrive as a `payload` field; slash commands arrive as the
      // flat form fields themselves.
      c.set(
        "slackBody",
        payload ? JSON.parse(payload) : Object.fromEntries(params),
      );
    }

    await next();
  },
);
