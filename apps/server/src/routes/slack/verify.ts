import { env } from "@/env";
import { createMiddleware } from "hono/factory";

export const verifySlackSignature = createMiddleware<{
  Variables: { slackBody: unknown };
}>(async (c, next) => {
  const signingSecret = env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    return c.json({ error: "Slack not configured" }, 503);
  }

  const timestamp = c.req.header("x-slack-request-timestamp");
  const signature = c.req.header("x-slack-signature");

  if (!timestamp || !signature) {
    return c.json({ error: "Missing Slack headers" }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
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
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(basestring));
  const computed = `v0=${Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  if (computed.length !== signature.length) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const a = encoder.encode(computed);
  const b = encoder.encode(signature);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  if (mismatch !== 0) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    c.set("slackBody", JSON.parse(rawBody));
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payload = params.get("payload");
    c.set("slackBody", payload ? JSON.parse(payload) : {});
  }

  await next();
});
