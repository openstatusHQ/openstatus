import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod";

import { chatSession } from "./chat_session";
import { chatStoredMessagesSchema, chatTitleSchema } from "./messages";

export {
  chatStoredMessagesSchema,
  chatTitleSchema,
  messagePartSchema,
  storedMessageSchema,
  type ChatMessagePart,
  type ChatStoredMessage,
} from "./messages";

export const insertChatSessionSchema = createInsertSchema(chatSession, {
  title: chatTitleSchema,
  messages: chatStoredMessagesSchema,
});

export const selectChatSessionSchema = createSelectSchema(chatSession, {
  title: chatTitleSchema,
  messages: chatStoredMessagesSchema,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = z.infer<typeof selectChatSessionSchema>;
