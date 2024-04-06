import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, eq, inArray, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import {
  monitor,
  monitorsToPages,
  page,
  pageSubscriber,
} from "@openstatus/db/src/schema";
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

const PageSchema = z.object({
  id: z.number().openapi({
    description: "The id of the page",
    example: 1,
  }),
  title: z.string().openapi({
    description: "The title of the page",
    example: "My Page",
  }),
  description: z.string().openapi({
    description: "The description of the page",
    example: "My awesome status page",
  }),
  slug: z.string().openapi({
    description: "The slug of the page",
    example: "my-page",
  }),
  customDomain: z
    .string()
    .openapi({
      description: "The custom domain of the page",
      example: "my-page.com",
    })
    .transform((val) => (val ? val : undefined))
    .nullish(),

  icon: z
    .string()
    .openapi({
      description: "The icon of the page",
      example: "https://example.com/icon.png",
    })
    .url()
    .or(z.literal(""))
    .transform((val) => (val ? val : undefined))
    .nullish(),
  monitors: z
    .array(z.number())
    .openapi({
      description: "The monitors of the page",
      example: [1, 2],
    })
    .optional(),
});

const CreatePageSchema = z.object({
  title: z.string().openapi({
    description: "The title of the page",
    example: "My Page",
  }),
  description: z.string().openapi({
    description: "The description of the page",
    example: "My awesome status page",
  }),
  icon: z
    .string()
    .url()
    .openapi({
      description: "The icon of the page",
      example: "https://example.com/icon.png",
    })
    .optional(),
  slug: z.string().openapi({
    description: "The slug of the page",
    example: "my-page",
  }),
  customDomain: z
    .string()
    .openapi({
      description: "The custom domain of the page",
      example: "my-page.com",
    })
    .optional()
    .default(""),
  monitors: z
    .array(z.number())
    .openapi({
      description: "The monitors of the page",
      example: [1, 2],
    })
    .nullish(),
});

const UpdatePageSchema = z.object({
  title: z
    .string()
    .openapi({
      description: "The title of the page",
      example: "My Page",
    })
    .optional(),
  description: z.string().openapi({
    description: "The description of the page",
    example: "My awesome status page",
  }),
  icon: z
    .string()
    .url()
    .openapi({
      description: "The icon of the page",
      example: "https://example.com/icon.png",
    })
    .optional(),
  slug: z
    .string()
    .openapi({
      description: "The slug of the page",
      example: "my-page",
    })
    .optional(),
  customDomain: z
    .string()
    .openapi({
      description: "The custom domain of the page",
      example: "my-page.com",
    })
    .optional()
    .default(""),
  monitors: z
    .array(z.number())
    .openapi({
      description: "The monitors of the page",
      example: [1, 2],
    })
    .nullish(),
});

const pageSubscriberSchema = z.object({
  email: z.string().email().openapi({
    description: "The email of the subscriber",
  }),
});

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

  if (!_page) return c.json({ code: 401, message: "Not authorized" }, 401);

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
    return c.json({ code: 401, message: "Already subscribed" }, 401);

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

  return c.json({
    ...data,
  });
});

const getRoute = createRoute({
  method: "get",
  tags: ["page"],
  description: "Get a status page",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PageSchema,
        },
      },
      description: "Get an Status page",
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

pageApi.openapi(getRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const pageId = Number(id);
  const result = await db
    .select()
    .from(page)
    .where(and(eq(page.workspaceId, workspaceId), eq(page.id, pageId)))
    .get();

  if (!result) return c.json({ code: 404, message: "Not Found" }, 404);
  const data = PageSchema.parse(result);

  return c.json(data);
});

const getAllRoute = createRoute({
  method: "get",
  tags: ["page"],
  description: "Get all your status page",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(PageSchema),
        },
      },
      description: "Get an Status page",
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

pageApi.openapi(getAllRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));

  const result = await db
    .select()
    .from(page)
    .where(and(eq(page.workspaceId, workspaceId)));

  if (!result) return c.json({ code: 404, message: "Not Found" }, 404);
  const data = z.array(PageSchema).parse(result);

  return c.json(data);
});

const postRoute = createRoute({
  method: "post",
  tags: ["page"],
  description: "Create a status page",
  path: "/",
  request: {
    body: {
      description: "The status page to create",
      content: {
        "application/json": {
          schema: CreatePageSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PageSchema,
        },
      },
      description: "Get an Status page",
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

pageApi.openapi(postRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));

  // Check if the user has reached the limit of pages
  const count = (
    await db
      .select({ count: sql<number>`count(*)` })
      .from(page)
      .where(eq(page.workspaceId, workspaceId))
      .all()
  )[0].count;

  const workspacePlan = c.get("workspacePlan");

  if (count >= workspacePlan.limits["status-pages"])
    return c.json({ code: 403, message: "Forbidden" }, 403);

  const input = c.req.valid("json");

  const countSlug = (
    await db
      .select({ count: sql<number>`count(*)` })
      .from(page)
      .where(eq(page.slug, input.slug))
      .all()
  )[0].count;

  if (countSlug > 0)
    return c.json({ code: 400, message: "Slug already taken" }, 400);

  const { monitors, ...rest } = input;
  if (monitors) {
    const monitorsData = await db
      .select()
      .from(monitor)
      .where(
        and(
          inArray(monitor.id, monitors),
          eq(monitor.workspaceId, workspaceId),
        ),
      )
      .all();
    if (monitorsData.length !== monitors.length)
      return c.json({ code: 400, message: "Monitor not found" }, 400);
  }
  const newPage = await db
    .insert(page)
    .values({ workspaceId, ...rest })
    .returning()
    .get();

  if (monitors) {
    for (const monitorId of monitors) {
      await db
        .insert(monitorsToPages)
        .values({ pageId: newPage.id, monitorId })
        .run();
    }
  }
  const data = PageSchema.parse(newPage);
  return c.json(data);
});

const putRoute = createRoute({
  method: "put",
  tags: ["page"],
  description: "Update a status page",
  path: "/:id",
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
          schema: UpdatePageSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PageSchema,
        },
      },
      description: "Get an Status page",
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

pageApi.openapi(putRoute, async (c) => {
  const input = c.req.valid("json");

  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  if (!id) return c.json({ code: 400, message: "Bad Request" }, 400);

  const _page = await db
    .select()
    .from(page)
    .where(eq(page.id, Number(id)))
    .get();

  if (!_page) return c.json({ code: 404, message: "Not Found" }, 404);

  if (workspaceId !== _page.workspaceId)
    return c.json({ code: 401, message: "Unauthorized" }, 401);

  if (input.slug) {
    const countSlug = (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(page)
        .where(eq(page.slug, input.slug))
        .all()
    )[0].count;

    if (countSlug > 0)
      return c.json({ code: 400, message: "Slug already taken" }, 400);
  }
  const { monitors, ...rest } = input;
  if (monitors) {
    const monitorsData = await db
      .select()
      .from(monitor)
      .where(
        and(
          inArray(monitor.id, monitors),
          eq(monitor.workspaceId, workspaceId),
        ),
      )
      .all();
    if (monitorsData.length !== monitors.length)
      return c.json({ code: 400, message: "Monitor not found" }, 400);
  }

  const newPage = await db
    .update(page)
    .set({ ...rest })
    .returning()
    .get();

  const data = PageSchema.parse(newPage);

  if (monitors) {
    for (const monitorId of monitors) {
      await db
        .insert(monitorsToPages)
        .values({ pageId: _page.id, monitorId })
        .run();
    }
  }
  return c.json(data);
});

export { pageApi };
