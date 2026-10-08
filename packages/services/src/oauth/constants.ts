import type { SettableScope } from "@openstatus/db/src/schema/api-keys/constants";

export const ACCESS_TOKEN_PREFIX = "os_oat_";
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const REFRESH_GRACE_MS = 30 * 1000;
export const SESSION_TTL_MS = 30 * 60 * 1000;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CLIENT_PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export const DEFAULT_SCOPE: SettableScope[] = ["write"];

export const GRANT_TYPES = ["authorization_code", "refresh_token"] as const;
export const RESPONSE_TYPES = ["code"] as const;
export const CODE_CHALLENGE_METHODS = ["S256"] as const;
export const TOKEN_ENDPOINT_AUTH_METHODS = ["none"] as const;
