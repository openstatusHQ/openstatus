import type { DefaultUser } from "next-auth";

// FIXME: this is very wrong - no type `DefaultUser` exists
// also doenst provide autocomplete and type safety-ness

declare module "next-auth" {
  interface User extends Omit<DefaultUser, "id"> {
    id: number;
    email: string;
  }
}
