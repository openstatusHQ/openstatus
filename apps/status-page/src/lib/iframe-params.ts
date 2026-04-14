import { createParser, parseAsStringLiteral } from "nuqs/server";

export const ALL_IFRAME_SECTIONS = [
  "title",
  "banner",
  "components",
  "feed",
] as const;

export type IframeSection = (typeof ALL_IFRAME_SECTIONS)[number];

export type IframeState = { mode: boolean; sections: IframeSection[] };

export const iframeParser = createParser<IframeState>({
  parse(raw) {
    if (raw === "") {
      return { mode: true, sections: [...ALL_IFRAME_SECTIONS] };
    }
    const sections = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is IframeSection =>
        (ALL_IFRAME_SECTIONS as readonly string[]).includes(s),
      );
    // If nothing valid was parsed (e.g. `?iframe=,` or `?iframe=unknown`),
    // fall back to showing everything rather than a blank embed.
    if (sections.length === 0) {
      return { mode: true, sections: [...ALL_IFRAME_SECTIONS] };
    }
    return { mode: true, sections };
  },
  // NOTE: no writer (setIframe) exists today; the serializer is only reached
  // if one is added later. Returning "" for `!state.mode` could leak `?iframe=`
  // into the URL when exiting iframe mode from a narrowed section set —
  // revisit this logic when a writer is added.
  serialize(state) {
    if (!state.mode) return "";
    if (state.sections.length === ALL_IFRAME_SECTIONS.length) return "";
    return state.sections.join(",");
  },
  eq: (a, b) =>
    a.mode === b.mode &&
    a.sections.length === b.sections.length &&
    a.sections.every((s) => b.sections.includes(s)),
}).withDefault({ mode: false, sections: [...ALL_IFRAME_SECTIONS] });

export const iframeThemeParser = parseAsStringLiteral([
  "light",
  "dark",
] as const);
