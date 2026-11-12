/** `acme.com` ↔ `www.acme.com`, lowercased; null when stripping `www.` leaves no domain. */
export function wwwCounterpart(domain: string): string | null {
  const name = domain.toLowerCase();
  if (!name.startsWith("www.")) return `www.${name}`;
  const rest = name.slice(4);
  return rest.includes(".") ? rest : null;
}
