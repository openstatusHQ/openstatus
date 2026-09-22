import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (EyeSlash); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Hide = forwardRef<SVGSVGElement, IconProps>(
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
        d="M4.8077 13.1923C3.4687 12.267 2.56488 11.0325 2.04418 10.1133C1.65178 9.42061 1.65178 8.57951 2.04418 7.88681C2.99118 6.21511 5.2055 3.50009 8.9999 3.50009C10.708 3.50009 12.0959 4.0503 13.1921 4.8078"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M15.327 6.9151C15.578 7.2579 15.7869 7.58889 15.9556 7.88669C16.348 8.57939 16.348 9.42049 15.9556 10.1132C15.0086 11.7849 12.7943 14.4999 8.99994 14.4999C8.59234 14.4999 8.20304 14.4686 7.83154 14.4106"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M7.05551 10.9446C6.55781 10.4469 6.25 9.7594 6.25 9C6.25 7.4812 7.4812 6.25 9 6.25C9.7594 6.25 10.4469 6.55779 10.9445 7.05539"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M2 16L16 2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
    </svg>
  ),
);
Hide.displayName = "Hide";
