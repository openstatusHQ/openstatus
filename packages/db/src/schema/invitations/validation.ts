import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { invitation } from "./invitation";

export const insertInvitationSchema = createInsertSchema(invitation, {
  email: z.string().email(),
});

export const selectInvitationSchema = createSelectSchema(invitation);

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = z.infer<typeof selectInvitationSchema>;
