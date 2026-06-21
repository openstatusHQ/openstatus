import { locales } from "@openstatus/locales";

export type MarkdownTarget =
  | { kind: "overview" | "monitors" | "events" }
  | { kind: "monitor" | "report" | "maintenance"; id: number };

/**
 * Split the catch-all path into the page slug and rest-segments. Markdown is
 * locale-agnostic, so a locale segment is dropped — but only when actually
 * present, otherwise a real path segment would be consumed. Returns null when
 * the slug is missing.
 */
export function parseMarkdownPath(
  path: string[],
): { slug: string; rest: string[] } | null {
  const [slug, second, ...tail] = path;
  if (!slug) return null;
  const isLocale = (locales as readonly string[]).includes(second);
  const rest = isLocale ? tail : [second, ...tail].filter(Boolean);
  return { slug, rest };
}

function parseId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Pure dispatch over the catch-all rest-segments (everything after slug/locale).
 * Returns null for unknown shapes so the handler can 404.
 */
export function matchMarkdownRoute(rest: string[]): MarkdownTarget | null {
  const [first, second, third] = rest;

  if (rest.length === 0) return { kind: "overview" };

  if (first === "monitors") {
    if (rest.length === 1) return { kind: "monitors" };
    if (rest.length === 2) {
      const id = parseId(second);
      return id === null ? null : { kind: "monitor", id };
    }
    return null;
  }

  if (first === "events") {
    if (rest.length === 1) return { kind: "events" };
    if (
      rest.length === 3 &&
      (second === "report" || second === "maintenance")
    ) {
      const id = parseId(third);
      if (id === null) return null;
      return { kind: second === "report" ? "report" : "maintenance", id };
    }
    return null;
  }

  return null;
}
