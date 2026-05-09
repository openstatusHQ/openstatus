import {
  CHAT_TITLE_MAX_LENGTH,
  storedMessageSchema,
} from "@openstatus/db/src/schema";
import { z } from "zod";

export const CreateChatSessionInput = z.object({
  firstMessage: storedMessageSchema,
});
export type CreateChatSessionInput = z.infer<typeof CreateChatSessionInput>;

export const AppendChatSessionMessagesInput = z.object({
  sessionId: z.number().int(),
  messages: z.array(storedMessageSchema).min(1),
});
export type AppendChatSessionMessagesInput = z.infer<
  typeof AppendChatSessionMessagesInput
>;

export const SetChatSessionMessagesInput = z.object({
  sessionId: z.number().int(),
  // No `.min(1)` — replacing a session with an empty list is valid
  // (e.g. user wipes the conversation).
  messages: z.array(storedMessageSchema),
});
export type SetChatSessionMessagesInput = z.infer<
  typeof SetChatSessionMessagesInput
>;

export const GetChatSessionInput = z.object({
  sessionId: z.number().int(),
});
export type GetChatSessionInput = z.infer<typeof GetChatSessionInput>;

export const ListChatSessionsInput = z.object({}).strict();
export type ListChatSessionsInput = z.infer<typeof ListChatSessionsInput>;

export const DeleteChatSessionInput = z.object({
  sessionId: z.number().int(),
});
export type DeleteChatSessionInput = z.infer<typeof DeleteChatSessionInput>;

export { CHAT_TITLE_MAX_LENGTH };
