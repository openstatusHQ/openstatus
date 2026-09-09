import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { alertDeadLetter, alertInbox } from "./alert_inbox";

export const selectAlertInboxSchema = createSelectSchema(alertInbox);
export type AlertInbox = z.infer<typeof selectAlertInboxSchema>;

export const selectAlertDeadLetterSchema = createSelectSchema(alertDeadLetter);
export type AlertDeadLetter = z.infer<typeof selectAlertDeadLetterSchema>;
