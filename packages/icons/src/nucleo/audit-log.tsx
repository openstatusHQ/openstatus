import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (EyeScanner); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const AuditLog = forwardRef<SVGSVGElement, IconProps>(
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
        d="M3.756,9.809c-.342-.488-.342-1.13,0-1.618,.772-1.102,2.475-2.941,5.244-2.941s4.472,1.839,5.244,2.941c.342,.488,.342,1.13,0,1.618-.772,1.102-2.475,2.941-5.244,2.941s-4.472-1.839-5.244-2.941Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></path>
      <circle
        cx="9"
        cy="9"
        r="2"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></circle>
      <path
        d="M2.25,5.75v-1.5c0-1.105,.895-2,2-2h1.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="M12.25,2.25h1.5c1.105,0,2,.895,2,2v1.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="M15.75,12.25v1.5c0,1.105-.895,2-2,2h-1.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="M5.75,15.75h-1.5c-1.105,0-2-.895-2-2v-1.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
    </svg>
  ),
);
AuditLog.displayName = "AuditLog";
