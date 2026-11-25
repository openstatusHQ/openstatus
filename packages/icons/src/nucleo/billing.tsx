import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (CreditCard); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Billing = forwardRef<SVGSVGElement, IconProps>(
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
      <line
        x1="1.75"
        y1="7.25"
        x2="16.25"
        y2="7.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></line>
      <rect
        x="1.75"
        y="3.75"
        width="14.5"
        height="10.5"
        rx="2"
        ry="2"
        transform="translate(18 18) rotate(180)"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></rect>
      <line
        x1="4.25"
        y1="11.25"
        x2="7.25"
        y2="11.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></line>
      <line
        x1="12.75"
        y1="11.25"
        x2="13.75"
        y2="11.25"
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
Billing.displayName = "Billing";
