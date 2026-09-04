import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Robot); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Agent = forwardRef<SVGSVGElement, IconProps>(
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
        d="M9 2.25V5.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M15.75 14.25C15.75 15.355 14.855 16.25 13.75 16.25H4.25C3.145 16.25 2.25 15.355 2.25 14.25V7.25C2.25 6.145 3.145 5.25 4.25 5.25H13.75C14.855 5.25 15.75 6.145 15.75 7.25V14.25Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M6 11C6.552 11 7 10.552 7 10C7 9.448 6.552 9 6 9C5.448 9 5 9.448 5 10C5 10.552 5.448 11 6 11Z"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></path>
      <path
        d="M12 11C12.552 11 13 10.552 13 10C13 9.448 12.552 9 12 9C11.448 9 11 9.448 11 10C11 10.552 11.448 11 12 11Z"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></path>
      <path
        d="M2.25 10.75H1"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M15.75 10.75H17"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M9 3.25C9.897 3.25 10.625 2.5224 10.625 1.625C10.625 0.7276 9.897 0 9 0C8.103 0 7.375 0.7276 7.375 1.625C7.375 2.5224 8.103 3.25 9 3.25Z"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></path>
      <path
        d="M7.83327 11.5H10.1666C10.4886 11.5 10.7499 11.7613 10.7499 12.0833C10.7499 13.0493 9.96588 13.8333 8.99988 13.8333C8.03388 13.8333 7.24988 13.0493 7.24988 12.0833C7.24988 11.7613 7.51127 11.5 7.83327 11.5Z"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></path>
    </svg>
  ),
);
Agent.displayName = "Agent";
