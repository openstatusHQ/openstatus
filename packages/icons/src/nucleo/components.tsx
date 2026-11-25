import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (GridLayout); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Components = forwardRef<SVGSVGElement, IconProps>(
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
        x="2.75"
        y="2.75"
        width="4.5"
        height="3.5"
        rx="1"
        ry="1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></rect>
      <rect
        x="2.75"
        y="9.25"
        width="4.5"
        height="6"
        rx="1"
        ry="1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></rect>
      <rect
        x="10.75"
        y="11.75"
        width="4.5"
        height="3.5"
        rx="1"
        ry="1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></rect>
      <rect
        x="10.75"
        y="2.75"
        width="4.5"
        height="6"
        rx="1"
        ry="1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></rect>
    </svg>
  ),
);
Components.displayName = "Components";
