/** Display name for a user row: name, then first/last, then email. */
export function personName(
  person: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null,
): string | null {
  if (!person) return null;
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return person.name || full || person.email || null;
}
