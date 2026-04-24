import { insertPageSchema } from "@openstatus/db/src/schema";
import { pageAccessTypes } from "@openstatus/db/src/schema/pages/constants";
import {
  customDomainSchema,
  slugSchema,
} from "@openstatus/db/src/schema/pages/validation";
import { locales } from "@openstatus/locales";
import { z } from "zod";

export { pageAccessTypes };

/**
 * Full-form create — matches the legacy `pageRouter.create` input shape
 * (the drizzle insert schema). We type it explicitly because the inferred
 * `z.infer<typeof insertPageSchema>` references drizzle-zod internals that
 * aren't cleanly portable across the workspace boundary.
 */
export const CreatePageInput = insertPageSchema;
export type CreatePageInput = {
  id?: number;
  workspaceId?: number;
  title: string;
  description?: string;
  slug: string;
  customDomain?: string;
  icon?: string | null;
  legacyPage?: boolean;
  passwordProtected?: boolean | null;
  password?: string | null;
  accessType?: (typeof pageAccessTypes)[number];
  authEmailDomains?: string[];
  allowedIpRanges?: string[];
  allowIndex?: boolean;
  forceTheme?: "light" | "dark" | "system";
  defaultLocale?: (typeof locales)[number];
  locales?: (typeof locales)[number][] | null;
  homepageUrl?: string | null;
  contactUrl?: string | null;
  configuration?: Record<string, unknown> | null;
  monitors?: Array<{ monitorId: number }>;
};

/** Minimal create — the onboarding / `new` path with no monitors. */
export const NewPageInput = z.object({
  title: z.string(),
  // Canonical `slugSchema` from db validation — regex + min(3).
  // Plain `z.string().toLowerCase()` here let malformed slugs through
  // that `insertPageSchema` would reject, so `create` and `new` had
  // diverging contracts.
  slug: slugSchema,
  icon: z.string().nullish(),
  description: z.string().nullish(),
});
export type NewPageInput = z.infer<typeof NewPageInput>;

export const DeletePageInput = z.object({ id: z.number().int() });
export type DeletePageInput = z.infer<typeof DeletePageInput>;

export const GetPageInput = z.object({ id: z.number().int() });
export type GetPageInput = z.infer<typeof GetPageInput>;

export const ListPagesInput = z.object({
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListPagesInput = z.infer<typeof ListPagesInput>;

export const GetSlugAvailableInput = z.object({
  // Same canonical `slugSchema` — don't want `getSlugAvailable` to
  // return a confident "available" answer for strings that `createPage`
  // would reject at insert time.
  slug: slugSchema,
});
export type GetSlugAvailableInput = z.infer<typeof GetSlugAvailableInput>;

export const UpdatePageGeneralInput = z.object({
  id: z.number().int(),
  title: z.string(),
  slug: slugSchema,
  description: z.string().nullish(),
  icon: z.string().nullish(),
});
export type UpdatePageGeneralInput = z.infer<typeof UpdatePageGeneralInput>;

/**
 * Only persists the `customDomain` change to the DB. Vercel domain
 * operations live at the transport layer — services don't touch external
 * integrations.
 */
export const UpdatePageCustomDomainInput = z.object({
  id: z.number().int(),
  // Canonical `customDomainSchema` enforces the same `no http://`,
  // `no https://`, `no www.` rules as `insertPageSchema`; empty string
  // ("" branch of the `.or(...)`) is still allowed so callers can
  // clear the domain.
  customDomain: customDomainSchema,
});
export type UpdatePageCustomDomainInput = z.infer<
  typeof UpdatePageCustomDomainInput
>;

export const UpdatePagePasswordProtectionInput = z.object({
  id: z.number().int(),
  accessType: z.enum(pageAccessTypes),
  authEmailDomains: z.array(z.string()).nullish(),
  password: z.string().nullish(),
  // Mirror the CIDR validation applied on insert (`insertPageSchema`): bare
  // IPs get `/32` appended, everything must be a valid IPv4 CIDR. Without
  // this the update path would happily persist malformed ranges.
  allowedIpRanges: z
    .array(
      z
        .string()
        .transform((s) => {
          const trimmed = s.trim();
          return trimmed.includes("/") ? trimmed : `${trimmed}/32`;
        })
        .pipe(z.cidrv4()),
    )
    .nullish(),
  allowIndex: z.boolean().optional(),
});
export type UpdatePagePasswordProtectionInput = z.infer<
  typeof UpdatePagePasswordProtectionInput
>;

export const UpdatePageAppearanceInput = z.object({
  id: z.number().int(),
  forceTheme: z.enum(["light", "dark", "system"]),
  configuration: z.object({ theme: z.string() }),
});
export type UpdatePageAppearanceInput = z.infer<
  typeof UpdatePageAppearanceInput
>;

export const UpdatePageLinksInput = z.object({
  id: z.number().int(),
  homepageUrl: z.string().nullish(),
  contactUrl: z.string().nullish(),
});
export type UpdatePageLinksInput = z.infer<typeof UpdatePageLinksInput>;

export const UpdatePageLocalesInput = z
  .object({
    id: z.number().int(),
    defaultLocale: z.enum(locales),
    locales: z.array(z.enum(locales)).nullable(),
  })
  .refine(
    (data) => (data.locales ? data.locales.includes(data.defaultLocale) : true),
    {
      message: "Default locale must be included in the locales list",
      path: ["defaultLocale"],
    },
  );
export type UpdatePageLocalesInput = z.infer<typeof UpdatePageLocalesInput>;

export const UpdatePageConfigurationInput = z.object({
  id: z.number().int(),
  configuration: z
    .record(z.string(), z.union([z.string(), z.boolean()]).optional())
    .nullish(),
});
export type UpdatePageConfigurationInput = z.infer<
  typeof UpdatePageConfigurationInput
>;
