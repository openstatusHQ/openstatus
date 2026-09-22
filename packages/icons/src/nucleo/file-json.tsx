import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-core-outline-24 (FileJson)
export const FileJson = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0 }}
      {...props}
    >
      <path
        d="M4.5 15V19.25C4.5 20.2165 3.7165 21 2.75 21V21C1.7835 21 1 20.2165 1 19.25V18.4286"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        data-color="color-2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      ></path>
      <path
        d="M9.5 15H8C7.17157 15 6.5 15.6716 6.5 16.5V16.5C6.5 17.3284 7.17157 18 8 18H9C9.82843 18 10.5 18.6716 10.5 19.5V19.5C10.5 20.3284 9.82843 21 9 21H7.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        data-color="color-2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      ></path>
      <path
        d="M18.5 21V15H19.5L22 21H23V15"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        data-color="color-2"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      ></path>
      <path
        d="M16.5 18C16.5 19.6569 15.4926 21 14.25 21C13.0074 21 12 19.6569 12 18C12 16.3431 13.0074 15 14.25 15C15.4926 15 16.5 16.3431 16.5 18Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        data-color="color-2"
        data-cap="butt"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      ></path>
      <path
        d="M4 9H11V2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeMiterlimit="10"
        data-cap="butt"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      ></path>
      <path
        d="M4 11V9.07843C4 8.54799 4.21071 8.03929 4.58579 7.66421L9.66421 2.58579C10.0393 2.21071 10.548 2 11.0784 2H18C19.1046 2 20 2.89543 20 4V11"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeMiterlimit="10"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      ></path>
    </svg>
  ),
);
FileJson.displayName = "FileJson";
