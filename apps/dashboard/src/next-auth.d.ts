import type { User as DefaultUserSchema } from "@openstatus/db/src/schema";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends DefaultUserSchema {}
}
