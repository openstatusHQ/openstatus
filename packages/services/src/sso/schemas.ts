import { z } from "zod";

export const PortalIntent = z.enum(["sso", "domain_verification"]);
export type PortalIntent = z.infer<typeof PortalIntent>;

export const CreateSsoPortalLinkInput = z.object({
  intent: PortalIntent,
  returnUrl: z.url(),
});
export type CreateSsoPortalLinkInput = z.infer<typeof CreateSsoPortalLinkInput>;

export const DisableSsoInput = z.object({
  reason: z.string().optional(),
});
export type DisableSsoInput = z.infer<typeof DisableSsoInput>;

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .refine((value) => !value.includes("@"), {
    message: "Expected a bare domain, not an email address",
  });

export const SyncSsoDomainInput = z.object({
  organizationId: z.string().min(1),
  domain: domainSchema,
  verifiedAt: z.date().nullable(),
});
export type SyncSsoDomainInput = z.infer<typeof SyncSsoDomainInput>;

export const RemoveSsoDomainInput = z.object({
  organizationId: z.string().min(1),
  domain: domainSchema,
});
export type RemoveSsoDomainInput = z.infer<typeof RemoveSsoDomainInput>;

export const JoinSsoWorkspaceInput = z.object({
  userId: z.number().int(),
});
export type JoinSsoWorkspaceInput = z.infer<typeof JoinSsoWorkspaceInput>;
