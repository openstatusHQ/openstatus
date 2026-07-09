import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Server); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Server = forwardRef<SVGSVGElement, IconProps>(
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
      <circle
        cx="4.25"
        cy="5.25"
        r=".75"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></circle>
      <circle
        cx="6.75"
        cy="5.25"
        r=".75"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></circle>
      <circle
        cx="4.25"
        cy="12.75"
        r=".75"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></circle>
      <circle
        cx="6.75"
        cy="12.75"
        r=".75"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></circle>
      <rect
        x="1.75"
        y="2.75"
        width="14.5"
        height="5"
        rx="1.5"
        ry="1.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></rect>
      <rect
        x="1.75"
        y="10.25"
        width="14.5"
        height="5"
        rx="1.5"
        ry="1.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></rect>
    </svg>
  ),
);
Server.displayName = "Server";
