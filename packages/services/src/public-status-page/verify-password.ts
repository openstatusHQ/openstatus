import { dbOnlyContext, type DB, getReadDb } from "../context";
import { ValidationError } from "../errors";
import { isPasswordAuthorized } from "../page-access";
import { findPageBySlug } from "./internal";
import { PublicPasswordInput } from "./schemas";

export class InvalidPagePasswordError extends ValidationError {
  constructor() {
    super("Invalid password");
  }
}

/** `null` when no page matches; throws `InvalidPagePasswordError` for a wrong password. */
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
  if (
    !isPasswordAuthorized({
      stored: page.password,
      queryPassword: input.password,
      cookiePassword: null,
    })
  ) {
    throw new InvalidPagePasswordError();
  }
  return true;
}
