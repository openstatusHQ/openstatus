import { createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod";

import { slackUser } from "./slack_user";

export const selectSlackUserSchema = createSelectSchema(slackUser);

export type SlackUser = z.infer<typeof selectSlackUserSchema>;
