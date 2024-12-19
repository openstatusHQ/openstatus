import { type UnsafeUnwrappedCookies, cookies } from "next/headers";

import { COOKIE_NAME } from "./shared";
import { preferencesSchema } from "./validation";

export function getPreferredSettings() {
  const cookie = (cookies() as unknown as UnsafeUnwrappedCookies).get(
    COOKIE_NAME,
  );
  const parsed = cookie ? JSON.parse(cookie.value) : {};
  const settings = preferencesSchema.safeParse(parsed);
  if (!settings.success) return undefined;
  return settings.data;
}

export type PreferredSettings = ReturnType<typeof getPreferredSettings>;
