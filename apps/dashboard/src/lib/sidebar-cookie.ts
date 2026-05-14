import { cookies } from "next/headers";

// Must match the upstream shadcn `SIDEBAR_COOKIE_NAME` default; that constant
// is not exported from `@openstatus/ui`.
export const LEFT_SIDEBAR_COOKIE = "sidebar_state";
export const RIGHT_SIDEBAR_COOKIE = "sidebar_state_right";

export async function getSidebarDefaultOpen(
  cookieName: string,
  fallback: boolean,
) {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(cookieName);
  if (!cookie) return fallback;
  return cookie.value === "true";
}
