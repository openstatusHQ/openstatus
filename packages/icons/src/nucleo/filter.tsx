import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Filter); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Filter = forwardRef<SVGSVGElement, IconProps>(
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
      <polygon
        points="10.5 14.75 7.5 16.25 7.5 9 2.75 2.75 15.25 2.75 10.5 9 10.5 14.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></polygon>
    </svg>
  ),
);
Filter.displayName = "Filter";
