import {
  type SettableScope,
  scopePresets,
} from "@openstatus/db/src/schema/api-keys/constants";

export const ACCESS_TOKEN_PREFIX = "os_oat_";
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const REFRESH_GRACE_MS = 30 * 1000;
export const SESSION_TTL_MS = 30 * 60 * 1000;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CLIENT_PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

// What a client gets when it sends no `scope`: the setup preset, since the
// setup tools are the reason to connect (plan open decision 2).
export const DEFAULT_SCOPE: SettableScope[] = [...scopePresets.setup];

export const GRANT_TYPES = ["authorization_code", "refresh_token"] as const;
export const RESPONSE_TYPES = ["code"] as const;
export const CODE_CHALLENGE_METHODS = ["S256"] as const;
export const TOKEN_ENDPOINT_AUTH_METHODS = ["none"] as const;
