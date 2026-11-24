import { z } from "zod";

const slug = z.string().toLowerCase();

export const PublicPageInput = z.object({ slug });
export type PublicPageInput = z.infer<typeof PublicPageInput>;

export const PublicPageEntityInput = z.object({ slug, id: z.number() });
export type PublicPageEntityInput = z.infer<typeof PublicPageEntityInput>;

export const PublicPageUptimeInput = z.object({
  slug,
  pageComponentIds: z.array(z.number()),
});
export type PublicPageUptimeInput = z.infer<typeof PublicPageUptimeInput>;

export const PublicEmailDomainInput = z.object({ slug, email: z.string() });
export type PublicEmailDomainInput = z.infer<typeof PublicEmailDomainInput>;

export const PublicPasswordInput = z.object({ slug, password: z.string() });
export type PublicPasswordInput = z.infer<typeof PublicPasswordInput>;

export const PublicPasswordAuthorizedInput = z.object({
  slug,
  queryPassword: z.string().nullish(),
  cookiePassword: z.string().nullish(),
});
export type PublicPasswordAuthorizedInput = z.infer<
  typeof PublicPasswordAuthorizedInput
>;
