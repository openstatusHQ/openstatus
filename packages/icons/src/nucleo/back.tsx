import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (ArrowLeft); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Back = forwardRef<SVGSVGElement, IconProps>(
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
      <line
        x1="2.75"
        y1="9"
        x2="15.25"
        y2="9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></line>
      <polyline
        points="7 13.25 2.75 9 7 4.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></polyline>
    </svg>
  ),
);
Back.displayName = "Back";
