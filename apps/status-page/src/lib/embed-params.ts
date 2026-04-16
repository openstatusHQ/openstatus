import { createParser, parseAsStringLiteral } from "nuqs/server";

export const ALL_EMBED_SECTIONS = [
  "title",
  "banner",
  "components",
  "feed",
] as const;

export type EmbedSection = (typeof ALL_EMBED_SECTIONS)[number];

export type EmbedState = { mode: boolean; sections: EmbedSection[] };

export const embedParser = createParser<EmbedState>({
  parse(raw) {
    if (raw === "") {
      return { mode: true, sections: [...ALL_EMBED_SECTIONS] };
    }
    const sections = Array.from(
      new Set(
        raw
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s): s is EmbedSection =>
            (ALL_EMBED_SECTIONS as readonly string[]).includes(s),
          ),
      ),
    );
    // If nothing valid was parsed (e.g. `?embed=,` or `?embed=unknown`),
    // fall back to showing everything rather than a blank embed.
    if (sections.length === 0) {
      return { mode: true, sections: [...ALL_EMBED_SECTIONS] };
    }
    return { mode: true, sections };
  },
  // NOTE: no writer (setEmbed) exists today; the serializer is only reached
  // if one is added later. Returning "" for `!state.mode` could leak `?embed=`
  // into the URL when exiting embed mode from a narrowed section set —
  // revisit this logic when a writer is added.
  serialize(state) {
    if (!state.mode) return "";
    if (state.sections.length === ALL_EMBED_SECTIONS.length) return "";
    return state.sections.join(",");
  },
  eq: (a, b) => {
    if (a.mode !== b.mode || a.sections.length !== b.sections.length)
      return false;
    const bSet = new Set(b.sections);
    return a.sections.every((s) => bSet.has(s));
  },
}).withDefault({ mode: false, sections: [...ALL_EMBED_SECTIONS] });

export const embedThemeParser = parseAsStringLiteral([
  "light",
  "dark",
] as const);
