import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, eq } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import { SubscribeEmail } from "@openstatus/emails";
import { sendEmail } from "@openstatus/emails/emails/send";

import type { Variables } from ".";
import { ErrorSchema } from "./shared";

const pageApi = new OpenAPIHono<{ Variables: Variables }>();

const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the page",
      example: "1",
    }),
});

const pageSubscriberSchema = z.object({
  email: z.string().email().openapi({
    description: "The email of the subscriber",
  }),
});

const postRouteSubscriber = createRoute({
  method: "post",
  tags: ["status_report"],
  path: "/:id/update",
  description: "Add a subscriber to a status report",
  request: {
    params: ParamsSchema,
    body: {
      description: "the subscriber payload",
      content: {
        "application/json": {
          schema: z.object({
            email: z
              .string()
              .email()
              .openapi({ description: "The email of the subscriber" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: pageSubscriberSchema,
        },
      },
      description: "The user",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

pageApi.openapi(postRouteSubscriber, async (c) => {
  const input = c.req.valid("json");
  const { id } = c.req.valid("param");
  const workspaceId = Number(c.get("workspaceId"));

  const pageId = Number(id);
  const _page = await db
    .select()
    .from(page)
    .where(and(eq(page.id, pageId), eq(page.workspaceId, workspaceId)))
    .get();

  if (!_page) return c.jsonT({ code: 401, message: "Not authorized" }, 401);

  const alreadySubscribed = await db
    .select()
    .from(pageSubscriber)
    .where(
      and(
        eq(pageSubscriber.email, input.email),
        eq(pageSubscriber.pageId, pageId),
      ),
    )
    .get();
  if (alreadySubscribed)
    return c.jsonT({ code: 401, message: "Already subscribed" }, 401);

  // TODO: send email for verification
  const token = (Math.random() + 1).toString(36).substring(10);

  await sendEmail({
    react: SubscribeEmail({
      domain: _page.slug,
      token: token,
      page: page.title,
    }),
    from: "OpenStatus <notification@openstatus.dev>",
    to: [input.email],
    subject: "Verify your subscription",
  });
  const _statusReportSubscriberUpdate = await db
    .insert(pageSubscriber)
    .values({
      pageId: _page.id,
      email: input.email,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    })
    .returning()
    .get();

  const data = pageSubscriberSchema.parse(_statusReportSubscriberUpdate);

  return c.jsonT({
    ...data,
  });
});
