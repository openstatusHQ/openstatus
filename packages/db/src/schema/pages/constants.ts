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
];

export const pageAccessTypes = [
  "public",
  "password",
  "email-domain",
  "ip-restriction",
] as const;

// written on create; stays "requests" until pages have moved to "runs"
export const NEW_PAGE_CONFIGURATION_VALUE = "requests" as const;
