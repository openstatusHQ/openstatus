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

export const PageSchema = z
  .object({
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
      .transform((val) => (val ? val : undefined))
      .nullish()
      .openapi({
        description:
          "The custom domain of the page. To be configured within the dashboard.",
        example: "status.acme.com",
      }),
    icon: z
      .url()
      .or(z.literal(""))
      .transform((val) => (val ? val : undefined))
      .nullish()
      .openapi({
        description: "The icon of the page",
        example: "https://example.com/icon.png",
      }),
    passwordProtected: z.boolean().optional().prefault(false).openapi({
      description:
        "Deprecated in favor of `accessType`. Used to set the password protection type. Returns true if `accessType` is set to 'password' and false otherwise.",
      example: true,
      deprecated: true,
    }),
    accessType: z
      .enum(["public", "password", "email-domain"])
      .default("public")
      .openapi({
        description: "The access type of the page",
        example: "public",
      }),
    password: z.string().optional().nullish().openapi({
      description: "Your password to protect the page from the public",
      example: "hidden-password",
    }),
    authEmailDomains: z
      .array(z.string())
      .optional()
      .nullish()
      .openapi({
        description: "The email domains of the page",
        example: ["example.com", "example.org"],
      }),
    showMonitorValues: z.boolean().optional().nullish().prefault(true).openapi({
      description:
        "Displays the total and failed request numbers for each monitor. Deprecated and will be removed in the future in favor for `configuration` property.",
      example: true,
      deprecated: true,
    }),
    monitors: z
      .array(z.number())
      .openapi({
        description:
          "The monitors of the page as an array of ids. We recommend using the object format to include the order.",
        deprecated: true,
        example: [1, 2],
      })
      .or(
        z
          .array(z.object({ monitorId: z.number(), order: z.number() }))
          .openapi({
            description: "The monitor as object allowing to pass id and order",
            example: [
              { monitorId: 1, order: 0 },
              { monitorId: 2, order: 1 },
            ],
          }),
      )
      .optional(),
  })
  .openapi("Page");

export type PageSchema = z.infer<typeof PageSchema>;

/**
 * Transforms page data to ensure passwordProtected reflects accessType
 * This should be used when parsing page data for responses
 *
 * NOTE: cannot be used in `PageSchema` because `.omit` is not supported otherwise
 */
export function transformPageData<
  T extends { accessType?: string; passwordProtected?: boolean },
>(data: T): T & { passwordProtected: boolean } {
  return {
    ...data,
    passwordProtected:
      data.accessType === "password" ? true : data.passwordProtected ?? false,
  };
}
