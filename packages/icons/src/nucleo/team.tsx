import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Users); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Team = forwardRef<SVGSVGElement, IconProps>(
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
        d="M5.75 8.25049C6.8546 8.25049 7.75 7.35549 7.75 6.25049C7.75 5.14549 6.8546 4.25049 5.75 4.25049C4.6454 4.25049 3.75 5.14549 3.75 6.25049C3.75 7.35549 4.6454 8.25049 5.75 8.25049Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M9.60903 15.1225C10.132 14.9475 10.439 14.3785 10.245 13.8635C9.56003 12.0455 7.80903 10.7515 5.75103 10.7515C3.69303 10.7515 1.94203 12.0455 1.25703 13.8635C1.06303 14.3795 1.37003 14.9485 1.89303 15.1225C2.85503 15.4435 4.17403 15.7505 5.75203 15.7505C7.33003 15.7505 8.64803 15.4435 9.60903 15.1225Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M12 5.75049C13.1046 5.75049 14 4.85549 14 3.75049C14 2.64549 13.1046 1.75049 12 1.75049C10.8954 1.75049 10 2.64549 10 3.75049C10 4.85549 10.8954 5.75049 12 5.75049Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M13.154 13.1873C14.2224 13.0845 15.1437 12.8614 15.858 12.6226C16.381 12.4476 16.688 11.8785 16.494 11.3636C15.809 9.54549 14.058 8.2515 12 8.2515C11.1608 8.2515 10.379 8.4771 9.69287 8.8555"
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
Team.displayName = "Team";
