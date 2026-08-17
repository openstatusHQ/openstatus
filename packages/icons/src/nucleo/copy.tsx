import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Copy2); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Copy = forwardRef<SVGSVGElement, IconProps>(
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
        d="M4.75,12.25h-1c-1.105,0-2-.895-2-2V4.75c0-1.105,.895-2,2-2h7.5c1.105,0,2,.895,2,2v1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></path>
      <rect
        x="4.75"
        y="5.75"
        width="11.5"
        height="9.5"
        rx="2"
        ry="2"
        transform="translate(21 21) rotate(180)"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></rect>
    </svg>
  ),
);
Copy.displayName = "Copy";
