import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (LayoutLeft); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const SidebarLeft = forwardRef<SVGSVGElement, IconProps>(
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
      <rect
        x="1.75"
        y="2.75"
        width="14.5"
        height="12.5"
        rx="2"
        ry="2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></rect>
      <line
        x1="4.75"
        y1="5.75"
        x2="4.75"
        y2="12.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></line>
    </svg>
  ),
);
SidebarLeft.displayName = "SidebarLeft";
