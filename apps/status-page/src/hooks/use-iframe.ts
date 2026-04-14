"use client";

import { iframeParser } from "@/lib/iframe-params";
import { useQueryState } from "nuqs";

export {
  ALL_IFRAME_SECTIONS,
  type IframeSection,
  type IframeState,
} from "@/lib/iframe-params";

export function useIframe() {
  const [state] = useQueryState("iframe", iframeParser);
  return state;
}
