import { cookies } from "next/headers";

import { COOKIE_NAME } from "./shared";
import { preferencesSchema } from "./validation";

export async function getPreferredSettings() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  const parsed = cookie ? JSON.parse(cookie.value) : {};
  const settings = preferencesSchema.safeParse(parsed);
  if (!settings.success) return undefined;
  return settings.data;
}

export type PreferredSettings = Awaited<
  ReturnType<typeof getPreferredSettings>
>;
