import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Book); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Docs = forwardRef<SVGSVGElement, IconProps>(
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
        d="M2.75 5.50002C2.75 3.76702 3.999 2.28701 5.707 1.99501L11.721 0.903015"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M15.25 4.75V15.25C15.25 15.802 14.802 16.25 14.25 16.25H4.75C3.645 16.25 2.75 15.355 2.75 14.25V5.75C2.75 4.645 3.645 3.75 4.75 3.75H14.25C14.802 3.75 15.25 4.198 15.25 4.75Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M5.75 3.75V16.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M12.25 7.25H8.75V9.25H12.25V7.25Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
      ></path>
    </svg>
  ),
);
Docs.displayName = "Docs";
