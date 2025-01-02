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

export const PageSubscriberSchema = z
  .object({
    id: z.number().openapi({
      description: "The id of the subscriber",
      example: 1,
    }),
    email: z.string().email().openapi({
      description: "The email of the subscriber",
    }),
    pageId: z.number().openapi({
      description: "The id of the page to subscribe to",
      example: 1,
    }),
  })
  .openapi("PageSubscriber");

export type PageSubscriberSchema = z.infer<typeof PageSubscriberSchema>;
