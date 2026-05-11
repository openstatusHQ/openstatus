/**
 * Verbatim message cap on the JSON column. When a session crosses this
 * threshold, the oldest entries are dropped on the next `append` so the
 * stored payload stays bounded.
 */
export const MAX_CHAT_MESSAGES = 20;

/**
 * Per (workspace, user) cap on chat sessions. Inserting a 21st row drops
 * the oldest by `updated_at` in the same transaction.
 */
export const MAX_CHAT_SESSIONS_PER_USER = 20;

/**
 * Title truncation length — first user message clipped to this many chars.
 */
export const CHAT_TITLE_MAX_LENGTH = 60;
