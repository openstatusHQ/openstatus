import type { redis } from "@openstatus/upstash";

// ---- Telegram API Types -----------------------------------------------------

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  first_name?: string;
  all_members_are_administrators?: boolean;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: Array<{
    offset: number;
    length: number;
    type: string;
  }>;
  new_chat_members?: TelegramUser[];
  new_chat_member?: TelegramUser;
  new_chat_participant?: TelegramUser;
}

interface TelegramChatMember {
  user: TelegramUser;
  status:
    | "member"
    | "administrator"
    | "left"
    | "creator"
    | "restricted"
    | "kicked";
  can_be_edited?: boolean;
  can_manage_chat?: boolean;
  can_change_info?: boolean;
  can_delete_messages?: boolean;
  can_invite_users?: boolean;
  can_restrict_members?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
  can_promote_members?: boolean;
  can_manage_video_chats?: boolean;
  can_post_stories?: boolean;
  can_edit_stories?: boolean;
  can_delete_stories?: boolean;
  is_anonymous?: boolean;
}

interface TelegramMyChatMemberUpdate {
  chat: TelegramChat;
  from: TelegramUser;
  date: number;
  old_chat_member: TelegramChatMember;
  new_chat_member: TelegramChatMember;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  my_chat_member?: TelegramMyChatMemberUpdate;
}

export interface TelegramGetUpdatesResponse {
  ok: boolean;
  result: TelegramUpdate[];
}

export type ValidUpdate =
  | {
      chatId: string;
      chatType: "private";
      user: { id: number; first_name: string; username?: string };
    }
  | {
      chatId: string;
      chatType: "group";
      chatTitle?: string;
      user: { id: number; first_name: string; username?: string };
    };

// ---- Helpers ----------------------------------------------------------------

function extractPrivateChatStart(
  update: TelegramUpdate,
  token: string,
): {
  chatId: string;
  user: { id: number; first_name: string; username?: string };
} | null {
  const { message } = update;

  if (
    !message ||
    message.chat.type !== "private" ||
    !message.text?.startsWith("/start ") ||
    !message.from
  ) {
    return null;
  }

  const receivedToken = message.text.split(" ")[1];
  if (!receivedToken || receivedToken !== token) return null;

  return {
    chatId: String(message.chat.id),
    user: {
      id: message.from.id,
      first_name: message.from.first_name,
      username: message.from.username,
    },
  };
}

function extractGroupBotAddition(
  update: TelegramUpdate,
  privateChatId: string,
  botUsername: string,
): {
  chatId: string;
  chatTitle?: string;
  user: { id: number; first_name: string; username?: string };
} | null {
  // Modern Telegram Bot API (v5.0+): bot additions come as my_chat_member updates
  if (update.my_chat_member) {
    const { my_chat_member } = update;

    const isInvalidGroupAddition =
      (my_chat_member.chat.type !== "group" &&
        my_chat_member.chat.type !== "supergroup") ||
      String(my_chat_member.from.id) !== privateChatId ||
      my_chat_member.new_chat_member.user.username !== botUsername ||
      (my_chat_member.new_chat_member.status !== "member" &&
        my_chat_member.new_chat_member.status !== "administrator");

    if (isInvalidGroupAddition) {
      return null;
    }

    return {
      chatId: String(my_chat_member.chat.id),
      chatTitle: my_chat_member.chat.title,
      user: {
        id: my_chat_member.from.id,
        first_name: my_chat_member.from.first_name,
        username: my_chat_member.from.username,
      },
    };
  }

  // Legacy fallback: service message with new_chat_member fields
  const { message } = update;

  const isInvalidGroupAddition =
    !message ||
    (message.chat.type !== "group" && message.chat.type !== "supergroup") ||
    !message.from ||
    String(message.from.id) !== privateChatId;

  if (isInvalidGroupAddition) {
    return null;
  }

  const isBotAdded =
    message.new_chat_participant?.username === botUsername ||
    message.new_chat_member?.username === botUsername ||
    message.new_chat_members?.some((m) => m.username === botUsername);

  if (!isBotAdded) return null;

  return {
    chatId: String(message.chat.id),
    chatTitle: message.chat.title,
    user: {
      id: message.from.id,
      first_name: message.from.first_name,
      username: message.from.username,
    },
  };
}

// ---- Main logic -------------------------------------------------------------

export async function processTelegramUpdates(args: {
  updates: TelegramUpdate[];
  workspaceId: number;
  privateChatId?: string;
  since?: number;
  botUsername: string;
  redisClient: typeof redis;
}): Promise<ValidUpdate[]> {
  const {
    updates,
    workspaceId,
    privateChatId,
    since,
    botUsername,
    redisClient,
  } = args;

  const validUpdates: ValidUpdate[] = [];

  // 1. Pre-filter by timestamp
  const recentUpdates = since
    ? updates.filter((u) => {
        if (u.message) return u.message.date >= since;
        if (u.my_chat_member) return u.my_chat_member.date >= since;
        return false;
      })
    : updates;

  // 2. Phase 1: private /start (no privateChatId filter)
  if (!privateChatId) {
    const tokenKey = `telegram:workspace_token:${workspaceId}`;
    const storedToken = await redisClient.get<string>(tokenKey);

    if (storedToken) {
      for (const update of recentUpdates) {
        const result = extractPrivateChatStart(update, storedToken);
        if (result) {
          // Single-use token: delete and stop
          await redisClient.del(tokenKey);
          validUpdates.push({ chatType: "private", ...result });
          break;
        }
      }
    }
  }
  // 3. Phase 2: group/supergroup additions
  else {
    for (const update of recentUpdates) {
      const result = extractGroupBotAddition(
        update,
        privateChatId,
        botUsername,
      );
      if (result) {
        validUpdates.push({ chatType: "group", ...result });
      }
    }
  }

  return validUpdates;
}
