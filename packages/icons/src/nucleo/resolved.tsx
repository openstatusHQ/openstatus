import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (MagnifierCheck); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Resolved = forwardRef<SVGSVGElement, IconProps>(
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
        d="M15.75 15.75L11.6386 11.6386"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M9.59891 2.5685C9.02111 2.3623 8.3987 2.25 7.75 2.25C4.7125 2.25 2.25 4.7125 2.25 7.75C2.25 10.7875 4.7125 13.25 7.75 13.25C10.7875 13.25 13.25 10.7875 13.25 7.75C13.25 7.7192 13.2497 7.6884 13.2492 7.6577"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M6.75 5.75L9 8.25L13.25 2.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
    </svg>
  ),
);
Resolved.displayName = "Resolved";
