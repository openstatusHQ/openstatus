import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

export type IconProps = LucideProps;
// structural, so it matches lucide's forwardRef exotics and the vendored nucleo components alike
export type IconType = ComponentType<IconProps>;
