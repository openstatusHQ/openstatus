import type { z } from "zod";

import type {
  basicMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import { env } from "../env";
import { EmailConfigurationSchema } from "./schema/config";

export const send = async ({
  monitor,
  notification,
}: {
  monitor: z.infer<typeof basicMonitorSchema>;
  notification: z.infer<typeof selectNotificationSchema>;
}) => {
  const config = EmailConfigurationSchema.parse(JSON.parse(notification.data));
  const { email } = config;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      to: email,
      from: "Notifications <ping@openstatus.dev>",

      subject: `Your monitor ${monitor.name} is down 🚨`,
      html: `Hey, <br/> Your monitor ${monitor.name} is down. <br/> <br/> OpenStatus`,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(data);
    // return NextResponse.json(data);
  }
};
