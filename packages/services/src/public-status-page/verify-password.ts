import { dbOnlyContext, type DB, getReadDb } from "../context";
import { ValidationError } from "../errors";
import { constantTimeEqual } from "../page-access";
import { findPageBySlug } from "./internal";
import { PublicPasswordInput } from "./schemas";

/** `null` when no page matches; throws when the password is wrong. */
export async function verifyPublicStatusPagePassword(args: {
  input: PublicPasswordInput;
  db?: DB;
}): Promise<true | null> {
  const input = PublicPasswordInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await findPageBySlug(db, input.slug);
  if (!page) return null;
  if (page.accessType !== "password") {
    throw new ValidationError(
      "Page is not configured to allow password authentication",
    );
  }
  if (!constantTimeEqual(page.password, input.password)) {
    throw new ValidationError("Invalid password");
  }
  return true;
}
