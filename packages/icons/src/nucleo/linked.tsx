import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Link2); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Linked = forwardRef<SVGSVGElement, IconProps>(
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
      <path
        d="M7.75,11.25c0,1.105-.895,2-2,2H3.25c-1.105,0-2-.895-2-2V6.75c0-1.105,.895-2,2-2h2.5c1.105,0,2,.895,2,2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="M10.25,6.75c0-1.105,.895-2,2-2h2.5c1.105,0,2,.895,2,2v4.5c0,1.105-.895,2-2,2h-2.5c-1.105,0-2-.895-2-2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <line
        x1="5.75"
        y1="9"
        x2="12.25"
        y2="9"
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
Linked.displayName = "Linked";
