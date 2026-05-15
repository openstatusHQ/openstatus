import { z } from "zod";

import { CHAT_TITLE_MAX_LENGTH, MAX_CHAT_MESSAGES } from "./constants";

// Pure-zod schemas split out of `validation.ts` so client code can import
// them without dragging the drizzle schema barrel into the client bundle.

/**
 * Persisted message-part shape. Mirrors AI SDK v6 `UIMessagePart` —
 * which is a union of `text`, `tool-<name>`, `reasoning`, `source-*`,
 * `file`, `data-*`, `step-start`. We don't enumerate them: storage
 * accepts any `{ type: string }` shape (`passthrough()` keeps unknown
 * fields). The route handler filters to the parts we actually need
 * for re-render (text + tool-*) before persisting.
 *
 * Also covers our compaction marker `tool-summary` — same loose shape.
 */
export const messagePartSchema = z.looseObject({
  type: z.string(),
});

export type ChatMessagePart = z.infer<typeof messagePartSchema>;

export const storedMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(messagePartSchema),
  /**
   * Server-stamped epoch ms of when this message was first persisted.
   * The service layer stamps `Date.now()` and preserves the original
   * value across the full-replace persistence, so older messages keep
   * their first-seen timestamp instead of being re-stamped per turn.
   */
  createdAt: z.number().int(),
});

export type ChatStoredMessage = z.infer<typeof storedMessageSchema>;

export const chatStoredMessagesSchema = z
  .array(storedMessageSchema)
  .max(MAX_CHAT_MESSAGES);

export const chatTitleSchema = z.string().min(1).max(CHAT_TITLE_MAX_LENGTH);
