import calSans from "@fonts/dashboard/CalSans-SemiBold.ttf";
import commitMono from "@fonts/dashboard/CommitMono-400-Regular.otf";
import commitMonoBold from "@fonts/dashboard/CommitMono-700-Regular.otf";
import geistMedium from "@fonts/geist/geist-sans/Geist-Medium.woff2";
import geistRegular from "@fonts/geist/geist-sans/Geist-Regular.woff2";
import { cancelRender, continueRender, delayRender } from "remotion";

export const fonts = {
  display: "Cal Sans",
  sans: "Geist",
  mono: "Commit Mono",
};

const faces: [family: string, url: string, weight: string][] = [
  [fonts.display, calSans, "600"],
  [fonts.sans, geistRegular, "400"],
  [fonts.sans, geistMedium, "500"],
  [fonts.mono, commitMono, "400"],
  [fonts.mono, commitMonoBold, "700"],
];

// Every frame waits until the brand fonts are in, so no frame falls back.
const handle = delayRender("brand fonts");
Promise.all(
  faces.map(([family, url, weight]) =>
    new FontFace(family, `url(${url})`, { weight }).load(),
  ),
)
  .then((loaded) => {
    for (const face of loaded) document.fonts.add(face);
    continueRender(handle);
  })
  .catch((err) => cancelRender(err));
