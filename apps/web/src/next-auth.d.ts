import type { DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends Omit<DefaultUser, "id"> {
    id: number;
    email: string;
  }
}
