// Kept dependency-free: the proxy sets this cookie, the login actions refresh
// it with the `#section` the proxy can't see, and /onboarding consumes it.
export const AUTH_REDIRECT_COOKIE = "auth-redirect";

export const AUTH_REDIRECT_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 10, // 10 minutes
} as const;
