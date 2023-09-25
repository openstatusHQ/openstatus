import type { z } from "zod";

import { send as sendEmail } from "@openstatus/resend";

export const mapTypeToFunction: {
  name: string; // todo: better type
  fn: (value: any) => void;
}[] = [{ name: "email", fn: sendEmail }];
