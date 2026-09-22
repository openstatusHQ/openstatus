import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { PreconditionFailedError } from "../errors";
import { resolveWorkOS } from "./client";
import { requireOwner } from "./internal";
import { CreateSsoPortalLinkInput } from "./schemas";

/**
 * WorkOS portal links expire five minutes after creation, so callers must
 * redirect immediately rather than rendering the link into a page.
 */
export async function createSsoPortalLink(args: {
  ctx: ServiceContext;
  input: CreateSsoPortalLinkInput;
}): Promise<{ link: string }> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CreateSsoPortalLinkInput.parse(args.input);

  await requireOwner(getReadDb(ctx), ctx);

  const organizationId = ctx.workspace.workosOrganizationId;
  if (!organizationId) {
    throw new PreconditionFailedError("SSO is not set up for this workspace");
  }

  const workos = resolveWorkOS(ctx.workos);
  const { link } = await workos.adminPortal.generateLink({
    intent: input.intent,
    organization: organizationId,
    returnUrl: input.returnUrl,
  });

  return { link };
}
