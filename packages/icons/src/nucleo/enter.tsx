import { forwardRef } from "react";

import type { IconProps } from "../types";

// derived from nucleo ReturnKey (ui-18): keycap border removed, arrow scaled 1.5x to fill the grid
export const Enter = forwardRef<SVGSVGElement, IconProps>(
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
        d="M11.625,4.75h2.25c.828,0,1.5,.672,1.5,1.5v3c0,.828-.672,1.5-1.5,1.5H2.625"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <polyline
        points="5.625 7.75 2.625 10.75 5.625 13.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></polyline>
    </svg>
  ),
);
Enter.displayName = "Enter";
