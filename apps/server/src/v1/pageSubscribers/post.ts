import { createRoute } from "@hono/zod-openapi";

import { and, eq } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import { SubscribeEmail } from "@openstatus/emails";
import { sendEmail } from "@openstatus/emails/emails/send";
import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { pageSubscribersApi } from "./index";
import { PageSubscriberSchema, ParamsSchema } from "./schema";

const postRouteSubscriber = createRoute({
  method: "post",
  tags: ["page"],
  path: "/:id/update",
  description: "Add a subscriber to a status page",
  request: {
    params: ParamsSchema,
    body: {
      description: "the subscriber payload",
      content: {
        "application/json": {
          schema: PageSubscriberSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PageSubscriberSchema,
        },
      },
      description: "The user",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostPageSubscriber(api: typeof pageSubscribersApi) {
  return api.openapi(postRouteSubscriber, async (c) => {
    const workspaceId = c.get("workspaceId");
    const input = c.req.valid("json");
    const { id } = c.req.valid("param");

    const _page = await db
      .select()
      .from(page)
      .where(
        and(eq(page.id, Number(id)), eq(page.workspaceId, Number(workspaceId)))
      )
      .get();

    if (!_page) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const alreadySubscribed = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.email, input.email),
          eq(pageSubscriber.pageId, Number(id))
        )
      )
      .get();

    if (alreadySubscribed) {
      throw new HTTPException(400, {
        message: "Bad request - Already subscribed",
      });
    }

    const token = (Math.random() + 1).toString(36).substring(10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await sendEmail({
      react: SubscribeEmail({
        domain: _page.slug,
        token,
        page: _page.title,
      }),
      from: "OpenStatus <notification@notifications.openstatus.dev>",
      to: [input.email],
      subject: "Verify your subscription",
    });

    const _statusReportSubscriberUpdate = await db
      .insert(pageSubscriber)
      .values({
        pageId: _page.id,
        email: input.email,
        token,
        expiresAt,
      })
      .returning()
      .get();

    const data = PageSubscriberSchema.parse(_statusReportSubscriberUpdate);

    return c.json(data, 200);
  });
}
