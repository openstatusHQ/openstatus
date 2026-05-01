const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
  "live.com",
  "msn.com",
  "yandex.com",
  "mail.com",
  "gmx.com",
  "fastmail.com",
  "me.com",
  "duck.com",
  "pm.me",
  "tutanota.com",
  "hey.com",
  "zoho.com",
  "ymail.com",
]);

export function getCompanyDomainFromEmail(
  email: string | null | undefined,
): string | null {
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}
