import type { Metadata } from "next";

import { THEME_EXPLORER_URL } from "../lib/theme-explorer-host";

export const TITLE = "Status Page";
export const DESCRIPTION =
  "Status page customization with built-in themes. Explore all themes and contribute your own theme.";

const OG_TITLE = "Theme Explorer";
const OG_DESCRIPTION =
  "Explore all themes for your status page and contribute new ones to the community.";
const FOOTER = "themes.openstatus.dev";
const IMAGE = "assets/og/theme-explorer.png";
const THEME_EXPLORER_IMAGE = `/api/og?title=${OG_TITLE}&description=${OG_DESCRIPTION}&footer=${FOOTER}&image=${IMAGE}`;

export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${TITLE}`,
    default: TITLE,
  },
  icons: "https://www.openstatus.dev/favicon.ico",
  description: DESCRIPTION,
  metadataBase: new URL("https://www.openstatus.dev"),
  // Unresolved hosts render the 404 off this layout — keep them out of the
  // index. Status pages and the theme explorer set their own `robots`.
  robots: { index: false, follow: false },
};

export const twitterMetadata: Metadata["twitter"] = {
  title: TITLE,
  description: DESCRIPTION,
  card: "summary_large_image",
};

export const ogMetadata: Metadata["openGraph"] = {
  title: TITLE,
  description: DESCRIPTION,
  type: "website",
};

/**
 * Theme explorer only — the OG image must never be inherited by a status page
 * or by the 404 an unresolved host lands on.
 */
export function themeExplorerMetadata({
  indexable,
}: {
  indexable: boolean;
}): Metadata {
  return {
    alternates: { canonical: THEME_EXPLORER_URL },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    twitter: { ...twitterMetadata, images: [THEME_EXPLORER_IMAGE] },
    openGraph: { ...ogMetadata, images: [THEME_EXPLORER_IMAGE] },
  };
}
