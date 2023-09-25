import type { z } from "zod";

import type { notificationName } from "@openstatus/db/src/schema";
import { send as sendEmail } from "@openstatus/resend";

// FIXME: Better type
export const mapTypeToFunction: {
  name: (typeof notificationName)[number]; // todo: better type
  fn: (value: any) => void;
}[] = [
  { name: "email", fn: sendEmail },
  { name: "slack", fn: () => {} },
  { name: "discord", fn: () => {} },
];
