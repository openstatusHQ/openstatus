"use client";

import { useQueryState } from "nuqs";

import { embedParser } from "../lib/embed-params";

export {
  ALL_EMBED_SECTIONS,
  type EmbedSection,
  type EmbedState,
} from "../lib/embed-params";

export function useEmbed() {
  const [state] = useQueryState("embed", embedParser);
  return state;
}
