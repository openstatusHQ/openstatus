import type * as Lucide from "./lucide";
import type * as Nucleo from "./nucleo";

// Both icon sets must expose identical names so the ICON_SET build alias
// can swap them freely. A missing icon fails compilation here.
type MissingInNucleo = Exclude<keyof typeof Lucide, keyof typeof Nucleo>;
type MissingInLucide = Exclude<keyof typeof Nucleo, keyof typeof Lucide>;

export type AssertIconParity = [MissingInNucleo, MissingInLucide] extends [
  never,
  never,
]
  ? true
  : { missingInNucleo: MissingInNucleo; missingInLucide: MissingInLucide };

export const assertIconParity: AssertIconParity = true;
