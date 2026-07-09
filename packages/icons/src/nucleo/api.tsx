import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (BracketsCurly); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Api = forwardRef<SVGSVGElement, IconProps>(
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
        d="M6.25,15.25h-1c-1.105,0-2-.895-2-2v-2.625c0-.897-.728-1.625-1.625-1.625,.897,0,1.625-.728,1.625-1.625v-2.625c0-1.105,.895-2,2-2h1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="M11.75,15.25h1c1.105,0,2-.895,2-2v-2.625c0-.897,.728-1.625,1.625-1.625-.897,0-1.625-.728-1.625-1.625v-2.625c0-1.105-.895-2-2-2h-1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></path>
    </svg>
  ),
);
Api.displayName = "Api";
