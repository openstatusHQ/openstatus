import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (ClonePlus); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Duplicate = forwardRef<SVGSVGElement, IconProps>(
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
        d="M7.25 9.5V5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M5 7.25H9.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M12.25 5.75H13.75C14.8546 5.75 15.75 6.6454 15.75 7.75V13.75C15.75 14.8546 14.8546 15.75 13.75 15.75H7.75C6.6454 15.75 5.75 14.8546 5.75 13.75V12.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M10.25 2.25H4.25C3.14543 2.25 2.25 3.14543 2.25 4.25V10.25C2.25 11.3546 3.14543 12.25 4.25 12.25H10.25C11.3546 12.25 12.25 11.3546 12.25 10.25V4.25C12.25 3.14543 11.3546 2.25 10.25 2.25Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
    </svg>
  ),
);
Duplicate.displayName = "Duplicate";
