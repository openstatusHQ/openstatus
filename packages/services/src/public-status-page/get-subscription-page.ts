import { selectWorkspaceSchema } from "@openstatus/db/src/schema";

import { dbOnlyContext, type DB, getReadDb } from "../context";
import { ForbiddenError, ValidationError } from "../errors";
import { requirePageAccess, type PageVisitor } from "../page-access";
import { bySlugOrDomain } from "./internal";
import { PublicPageInput } from "./schemas";

/** The page a visitor may self-subscribe to, or `null` when there is none. */
export async function getPublicSubscriptionPage(args: {
  input: PublicPageInput;
  visitor: PageVisitor;
  db?: DB;
}): Promise<{ id: number } | null> {
  const input = PublicPageInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await db.query.page.findFirst({
    where: bySlugOrDomain(input.slug),
    with: { workspace: true },
  });
  if (!page) return null;
  await requirePageAccess(page, args.visitor);

  const workspace = selectWorkspaceSchema.safeParse(page.workspace);
  if (!workspace.success) {
    throw new ValidationError("Workspace data is invalid");
  }
  if (!workspace.data.limits["status-subscribers"]) {
    throw new ForbiddenError("Upgrade to use status subscribers");
  }
  return { id: page.id };
}
