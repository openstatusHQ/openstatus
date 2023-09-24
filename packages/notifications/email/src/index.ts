import { Resend } from "resend";
import type { z } from "zod";

import type { EmailDataSchema } from "@openstatus/emails";
import { Alert } from "@openstatus/emails";

import { env } from "../env";
import type { EmailConfigurationSchema } from "./schema/config";

const resend = new Resend(env.RESEND_API_KEY);

const send = async ({
  data,
  config,
}: {
  data: z.infer<typeof EmailDataSchema>;
  config: z.infer<typeof EmailConfigurationSchema>;
}) => {
  const { to } = config;

  await resend.emails.send({
    to,
    from: "Notifications <ping@openstatus.dev>",
    subject: "Welcome to OpenStatus",
    react: Alert({ data }),
  });
};
