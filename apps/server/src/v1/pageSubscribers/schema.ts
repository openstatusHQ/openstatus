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

export const PageSubscriberSchema = z.object({
  email: z.string().email().openapi({
    description: "The email of the subscriber",
  }),
});

export type PageSubscriberSchema = z.infer<typeof PageSubscriberSchema>;
