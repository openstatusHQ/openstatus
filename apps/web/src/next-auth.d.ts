import type NextAuth from "next-auth";

import type { User as DefaultUserSchema } from "@openstatus/db/src/schema";

declare module "next-auth" {
  interface User extends DefaultUserSchema {}
}
