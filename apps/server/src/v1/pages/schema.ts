import { z } from "@hono/zod-openapi";

export const ParamsSchema = z.object({
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

export const PageSchema = z.object({
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
  // REMINDER: needs to be configured on Dashboard UI
  customDomain: z
    .string()
    .openapi({
      description:
        "The custom domain of the page. To be configured within the dashboard.",
      example: "status.acme.com",
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
  passwordProtected: z
    .boolean()
    .openapi({
      description:
        "Make the page password protected. Used with the 'passwordProtected' property.",
      example: true,
    })
    .default(false)
    .optional(),
  password: z
    .string()
    .openapi({
      description: "Your password to protect the page from the publi",
      example: "hidden-password",
    })
    .optional()
    .nullish(),
  monitors: z
    .array(z.number())
    .openapi({
      description: "The monitors of the page as an array of ids",
      example: [1, 2],
    })
    .or(
      z.array(z.object({ monitorId: z.number(), order: z.number() })).openapi({
        description: "The monitor as object allowing to pass id and order",
        example: [
          { monitorId: 1, order: 0 },
          { monitorId: 2, order: 1 },
        ],
      }),
    )
    .optional(),
});

export const PageSubscriberSchema = z.object({
  email: z.string().email().openapi({
    description: "The email of the subscriber",
  }),
});

export type PageSchema = z.infer<typeof PageSchema>;
export type PageSubscriberSchema = z.infer<typeof PageSubscriberSchema>;
