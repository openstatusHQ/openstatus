import { dbOnlyContext, type DB, getReadDb } from "../context";
import { ValidationError } from "../errors";
import { isEmailDomainAuthorized } from "../page-access";
import { findPageBySlug } from "./internal";
import { PublicEmailDomainInput } from "./schemas";

/** Never returns the raw row: it holds the password and the IP allow-list. */
export async function checkPublicEmailDomain(args: {
  input: PublicEmailDomainInput;
  db?: DB;
}): Promise<{ title: string } | null> {
  const input = PublicEmailDomainInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await findPageBySlug(db, input.slug);
  if (!page) return null;
  if (page.accessType !== "email-domain") {
    throw new ValidationError(
      "Page is not configured to allow email domain authentication",
    );
  }
  const allowedDomains = page.authEmailDomains?.split(",") ?? [];
  if (!isEmailDomainAuthorized(input.email, allowedDomains)) {
    throw new ValidationError("Invalid email domain");
  }
  return { title: page.title };
}
