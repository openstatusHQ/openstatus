import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (ChartActivity2); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Monitor = forwardRef<SVGSVGElement, IconProps>(
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
        d="M16.25,8.75h-2.297c-.422,0-.798,.265-.941,.661l-1.647,4.575c-.12,.334-.594,.328-.706-.008L7.341,4.022c-.112-.336-.586-.342-.706-.008l-1.647,4.575c-.143,.397-.519,.661-.941,.661H1.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
    </svg>
  ),
);
Monitor.displayName = "Monitor";
