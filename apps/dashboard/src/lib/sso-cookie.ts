// Kept dependency-free: the proxy reads this constant, and importing it from
// `lib/auth/sso` would pull the WorkOS SDK into the proxy bundle.
export const SSO_ORG_COOKIE = "sso-org";
