import { useState } from "react";

import { COOKIE_NAME } from "./shared";
import type { PreferredSettings } from "./validation";
import { preferencesSchema } from "./validation";

function getPreferredSettingsCookie() {
  const cookie = document.cookie
    .split(";")
    .find((cookie) => cookie.trim().startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return {};
  const settings = preferencesSchema.safeParse(
    JSON.parse(cookie.split("=")[1]),
  );
  if (!settings.success) return {};
  return settings.data;
}

function setPreferredSettingsCookie(value: Record<string, unknown>) {
  const month = 30 * 24 * 60 * 60 * 1000;
  const expires = new Date(Date.now() + month).toUTCString();
  document.cookie = `${COOKIE_NAME}=${JSON.stringify(
    value,
  )}; path=/; expires=${expires}`;
}

/**
 * Update user preferences and store them in a cookie accessible on the client and server
 */
export function usePreferredSettings(defaultValue: PreferredSettings) {
  const [settings, setSettings] = useState<PreferredSettings>(defaultValue);

  const handleChange = (value: Record<string, unknown>) => {
    const settings = preferencesSchema.safeParse(value);

    if (!settings.success) return;

    const currentSettings = getPreferredSettingsCookie();
    const newSettings = { ...currentSettings, ...settings.data };

    setPreferredSettingsCookie(newSettings);
    setSettings(newSettings);
  };

  return [settings, handleChange] as const;
}
