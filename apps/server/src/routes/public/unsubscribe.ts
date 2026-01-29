import { getLogger } from "@logtape/logtape";
import { Hono } from "hono";

import { db, eq } from "@openstatus/db";
import { pageSubscriber } from "@openstatus/db/src/schema";

const logger = getLogger("api-server");

/**
 * RFC 8058 One-Click Unsubscribe Endpoint
 *
 * This endpoint handles POST requests from email clients that support one-click unsubscribe.
 * Email clients send a POST request with form-urlencoded body containing "List-Unsubscribe=One-Click".
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8058
 */
export const unsubscribe = new Hono();

unsubscribe.post("/:token", async (c) => {
  try {
    const { token } = c.req.param();

    // Validate token is a valid UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return c.json({ error: "Invalid token format" }, 400);
    }

    // Find the subscriber by token
    const subscriber = await db
      .select()
      .from(pageSubscriber)
      .where(eq(pageSubscriber.token, token))
      .get();

    // Return 404 if subscriber not found
    if (!subscriber) {
      return c.json({ error: "Subscriber not found" }, 404);
    }

    // Check if subscriber has verified their subscription
    if (!subscriber.acceptedAt) {
      return c.json({ error: "Subscription not verified" }, 400);
    }

    // Check if already unsubscribed
    if (subscriber.unsubscribedAt) {
      // Return 200 OK even if already unsubscribed (idempotent)
      return c.json({ message: "Already unsubscribed" }, 200);
    }

    // Set unsubscribedAt timestamp
    await db
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.id, subscriber.id));

    // Return 200 OK on success
    return c.json({ message: "Successfully unsubscribed" }, 200);
  } catch (e) {
    logger.error("Error in one-click unsubscribe", {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});
