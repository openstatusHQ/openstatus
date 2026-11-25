import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Inbox); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Inbox = forwardRef<SVGSVGElement, IconProps>(
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
        d="M16.213,9.75c-.023-.12-.057-.238-.102-.353l-2.113-5.379c-.301-.765-1.039-1.269-1.862-1.269H5.863c-.822,0-1.561,.503-1.862,1.269L1.888,9.397c-.045,.114-.079,.232-.102,.353"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></path>
      <path
        d="M11.75,9.75v1c0,.552-.448,1-1,1h-3.5c-.552,0-1-.448-1-1v-1H1.787c-.024,.125-.037,.251-.037,.379v3.121c0,1.104,.895,2,2,2H14.25c1.105,0,2-.896,2-2v-3.121c0-.127-.013-.254-.037-.379h-4.463Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
    </svg>
  ),
);
Inbox.displayName = "Inbox";
