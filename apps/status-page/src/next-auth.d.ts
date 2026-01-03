import type { Viewer as DefaultViewerSchema } from "@openstatus/db/src/schema";

declare module "next-auth" {
  interface User extends DefaultViewerSchema {}
}
