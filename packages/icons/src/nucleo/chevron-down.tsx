import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (ChevronDown); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const ChevronDown = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      style={{ flexShrink: 0 }}
      {...props}
    >
      <polyline
        points="15.25 6.5 9 12.75 2.75 6.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></polyline>
    </svg>
  ),
);
ChevronDown.displayName = "ChevronDown";
