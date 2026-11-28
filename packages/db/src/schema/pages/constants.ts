export const subdomainSafeList = [
  "api",
  "app",
  "www",
  "docs",
  "checker",
  "time",
  "help",
  "data-table",
  "light",
  "workflows",
  "template",
  "ssh",
  "themes",
  "shop",
  "skills",
  "cli",
  "mail",
  "notifications",
  "ship",
  "subscribers",
  "events",
];

export const pageAccessTypes = [
  "public",
  "password",
  "email-domain",
  "ip-restriction",
] as const;

// card values of monitor checks; "manual" belongs to status reports only
export const pageCheckCardValues = ["duration", "requests", "runs"] as const;
export const pageCardValues = [...pageCheckCardValues, "manual"] as const;

// written on create; stays "requests" until pages have moved to "runs"
export const NEW_PAGE_CONFIGURATION_VALUE = "requests" as const;
