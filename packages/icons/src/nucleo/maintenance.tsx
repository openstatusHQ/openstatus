import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Hammer2); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Maintenance = forwardRef<SVGSVGElement, IconProps>(
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
        d="M11.529,8.721l-6.563,6.563c-.621,.621-1.629,.621-2.25,0h0c-.621-.621-.621-1.629,0-2.25l6.563-6.563"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="M16.207,8.944l-1.521,1.521c-.391,.391-1.024,.391-1.414,0L5.742,2.934l.934-.934,4.191,.493c.223,.026,.431,.127,.59,.286l4.75,4.75c.391,.391,.391,1.024,0,1.414Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></path>
    </svg>
  ),
);
Maintenance.displayName = "Maintenance";
