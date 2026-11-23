import {
  selectPageSchema,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";

import { dbOnlyContext, type DB, getReadDb } from "../context";
import { bySlugOrDomain } from "./internal";
import { PublicPageInput } from "./schemas";

// Reuses selectPageSchema's transforms so the domain and IP lists come back as arrays.
const gateFieldsSchema = selectPageSchema.pick({
  slug: true,
  customDomain: true,
  accessType: true,
  authEmailDomains: true,
  allowedIpRanges: true,
  homepageUrl: true,
  contactUrl: true,
  defaultTimezone: true,
});

export type PublicStatusPageGate = ReturnType<typeof gateFieldsSchema.parse> & {
  whiteLabel: boolean;
};

/** The gate and chrome fields only: what a route needs before it decides to load content. */
export async function getPublicStatusPageGate(args: {
  input: PublicPageInput;
  db?: DB;
}): Promise<PublicStatusPageGate | null> {
  const input = PublicPageInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const row = await db.query.page.findFirst({
    where: bySlugOrDomain(input.slug),
    columns: {
      slug: true,
      customDomain: true,
      accessType: true,
      authEmailDomains: true,
      allowedIpRanges: true,
      homepageUrl: true,
      contactUrl: true,
      defaultTimezone: true,
    },
    with: { workspace: true },
  });
  if (!row) return null;

  const { workspace, ...rest } = row;
  const ws = selectWorkspaceSchema.safeParse(workspace);
  return {
    ...gateFieldsSchema.parse(rest),
    whiteLabel: ws.data?.limits["white-label"] ?? false,
  };
}
