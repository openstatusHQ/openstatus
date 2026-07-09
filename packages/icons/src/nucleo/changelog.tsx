import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (ScrollText); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Changelog = forwardRef<SVGSVGElement, IconProps>(
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
        d="M14.75,15.75c.828,0,1.5-.672,1.5-1.5v-1c0-.276-.224-.5-.5-.5h-7.5c-.276,0-.5,.224-.5,.5v1c0,.828-.672,1.5-1.5,1.5h0c-.828,0-1.5-.672-1.5-1.5V3.75c0-.828-.672-1.5-1.5-1.5h0c-.828,0-1.5,.672-1.5,1.5v2c0,.552,.448,1,1,1h2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <line
        x1="14.75"
        y1="15.75"
        x2="6.25"
        y2="15.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></line>
      <path
        d="M3.25,2.25H12.75c.828,0,1.5,.672,1.5,1.5v6.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <line
        x1="7.5"
        y1="5.75"
        x2="11.5"
        y2="5.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></line>
      <line
        x1="7.5"
        y1="8.75"
        x2="11.5"
        y2="8.75"
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
Changelog.displayName = "Changelog";
