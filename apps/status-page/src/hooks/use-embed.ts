"use client";

import { embedParser } from "@/lib/embed-params";
import { useQueryState } from "nuqs";

export {
  ALL_EMBED_SECTIONS,
  type EmbedSection,
  type EmbedState,
} from "@/lib/embed-params";

export function useEmbed() {
  const [state] = useQueryState("embed", embedParser);
  return state;
}
