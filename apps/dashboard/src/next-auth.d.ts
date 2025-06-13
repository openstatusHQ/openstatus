// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type NextAuth from "next-auth";

import type { User as DefaultUserSchema } from "@openstatus/db/src/schema";

declare module "next-auth" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends DefaultUserSchema {}
}
