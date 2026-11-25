import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (BarsFilter); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const ListFilter = forwardRef<SVGSVGElement, IconProps>(
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
        x1="5.25"
        y1="9"
        x2="12.75"
        y2="9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></line>
      <line
        x1="2.75"
        y1="4.25"
        x2="15.25"
        y2="4.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></line>
      <line
        x1="8"
        y1="13.75"
        x2="10"
        y2="13.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></line>
    </svg>
  ),
);
ListFilter.displayName = "ListFilter";
