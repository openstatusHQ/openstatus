import { dbOnlyContext, type DB, getReadDb } from "../context";
import { isPasswordAuthorized } from "../page-access";
import { bySlugOrDomain } from "./internal";
import { PublicPasswordAuthorizedInput } from "./schemas";

/** A boolean, so the stored password never leaves the server. */
export async function isPublicStatusPagePasswordAuthorized(args: {
  input: PublicPasswordAuthorizedInput;
  db?: DB;
}): Promise<boolean> {
  const input = PublicPasswordAuthorizedInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await db.query.page.findFirst({
    where: bySlugOrDomain(input.slug),
    columns: { password: true, accessType: true },
  });
  if (!page || page.accessType !== "password") return false;
  // TODO: rate-limit — an unauthenticated caller can brute-force guesses here.
  return isPasswordAuthorized({
    stored: page.password,
    queryPassword: input.queryPassword,
    cookiePassword: input.cookiePassword,
  });
}
