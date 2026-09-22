import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (TableRows3Cols2); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Table = forwardRef<SVGSVGElement, IconProps>(
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
        d="M9 2.75V15.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M2.25 6.75H15.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M2.25 11.25H15.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M13.75 2.75H4.25C3.1454 2.75 2.25 3.65 2.25 4.75V13.25C2.25 14.35 3.1454 15.25 4.25 15.25H13.75C14.8546 15.25 15.75 14.35 15.75 13.25V4.75C15.75 3.65 14.8546 2.75 13.75 2.75Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
    </svg>
  ),
);
Table.displayName = "Table";
