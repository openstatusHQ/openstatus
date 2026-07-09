import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (UserPlus); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Invite = forwardRef<SVGSVGElement, IconProps>(
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
        d="M9 7.2505C10.5188 7.2505 11.75 6.0195 11.75 4.5005C11.75 2.9815 10.5188 1.7505 9 1.7505C7.4812 1.7505 6.25 2.9815 6.25 4.5005C6.25 6.0195 7.4812 7.2505 9 7.2505Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M17.25 14.7505H12.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M14.75 12.2505V17.2505"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M12.2164 10.677C11.2752 10.102 10.1839 9.7505 8.99999 9.7505C6.44899 9.7505 4.26099 11.2805 3.29099 13.4705C2.92599 14.2955 3.37799 15.2444 4.23799 15.5154C5.46299 15.9014 7.08389 16.2495 8.99999 16.2495C9.22329 16.2495 9.43029 16.2319 9.64399 16.2214"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
    </svg>
  ),
);
Invite.displayName = "Invite";
