import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (ChevronExpandY); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Expand = forwardRef<SVGSVGElement, IconProps>(
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
        points="12.5 6.25 9 2.75 5.5 6.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></polyline>
      <polyline
        points="12.5 11.75 9 15.25 5.5 11.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></polyline>
    </svg>
  ),
);
Expand.displayName = "Expand";
