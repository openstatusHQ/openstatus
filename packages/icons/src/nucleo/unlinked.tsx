import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Link2Slash); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Unlinked = forwardRef<SVGSVGElement, IconProps>(
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
        d="M4.75098 13.25H3.25098C2.14598 13.25 1.25098 12.355 1.25098 11.25V6.75C1.25098 5.645 2.14598 4.75 3.25098 4.75H5.75098C6.85598 4.75 7.75098 5.645 7.75098 6.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M16.4828 5.7496C16.6533 6.044 16.751 6.3856 16.751 6.75V11.25C16.751 12.355 15.856 13.25 14.751 13.25H12.251C11.3689 13.25 10.6206 12.6796 10.3546 11.8874"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M10.251 6.75C10.251 5.645 11.146 4.75 12.251 4.75H13.251"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M5.00098 9H9.00098"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M2.00098 16L16.001 2"
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
Unlinked.displayName = "Unlinked";
