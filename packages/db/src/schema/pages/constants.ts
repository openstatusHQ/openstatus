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

// written on create: the read default stays "requests" so pages that never
// stored a value keep their numbers
export const NEW_PAGE_CONFIGURATION_VALUE = "runs" as const;
