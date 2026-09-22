import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Router); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const PrivateLocation = forwardRef<SVGSVGElement, IconProps>(
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
        d="M13.75 10.75H4.25C2.869 10.75 1.75 11.869 1.75 13.25C1.75 14.631 2.869 15.75 4.25 15.75H13.75C15.131 15.75 16.25 14.631 16.25 13.25C16.25 11.869 15.131 10.75 13.75 10.75Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M4.25 14C4.664 14 5 13.664 5 13.25C5 12.836 4.664 12.5 4.25 12.5C3.836 12.5 3.5 12.836 3.5 13.25C3.5 13.664 3.836 14 4.25 14Z"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></path>
      <path
        d="M6.75 14C7.164 14 7.5 13.664 7.5 13.25C7.5 12.836 7.164 12.5 6.75 12.5C6.336 12.5 6 12.836 6 13.25C6 13.664 6.336 14 6.75 14Z"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></path>
      <path
        d="M11.75 6.25C12.716 6.25 13.5 5.466 13.5 4.5C13.5 3.534 12.716 2.75 11.75 2.75C10.784 2.75 10 3.534 10 4.5C10 5.466 10.784 6.25 11.75 6.25Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M8.39123 1.1412C6.53723 2.9952 6.53723 6.0047 8.39123 7.8587"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M15.1088 7.8588C16.9628 6.0048 16.9628 2.9953 15.1088 1.1413"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M11.75 6.25V10.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
    </svg>
  ),
);
PrivateLocation.displayName = "PrivateLocation";
