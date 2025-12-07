import { z } from "zod";

export const TelegramSchema = z.object({
  telegram: z.object({
    chatId: z.string(),
  }),
});
