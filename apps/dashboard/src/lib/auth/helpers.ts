import {
  createUserWithWorkspace,
  getUserByEmail as getUserByEmailService,
  getUserForAuth,
} from "@openstatus/services/user";
import type { AdapterUser } from "next-auth/adapters";
import * as randomWordSlugs from "random-word-slugs";

export { normalizeEmail } from "@openstatus/services/user";

/** An ambiguous legacy email throws, failing the sign-in with `?error=Configuration`. */
export function getUserByEmail(email: string) {
  return getUserByEmailService({ input: { email } });
}

export function createUser(data: AdapterUser) {
  return createUserWithWorkspace({
    input: {
      email: data.email,
      photoUrl: data.image,
      name: data.name,
      firstName: data.firstName,
      lastName: data.lastName,
    },
    generateSlug: () => randomWordSlugs.generateSlug(2),
  });
}

export function getUser(id: string) {
  return getUserForAuth({ input: { userId: Number(id) } });
}
