import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (CloudSlash); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const CloudOff = forwardRef<SVGSVGElement, IconProps>(
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
        d="M12.922 5.078C12.161 3.691 10.696 2.75 9 2.75C6.515 2.75 4.5 4.765 4.5 7.25C4.5 7.6 4.54899 7.936 4.62399 8.263C3.02699 8.33 1.75 9.637 1.75 11.25C1.75 12.604 2.647 13.748 3.879 14.121"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="M2 16L16 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></path>
      <path
        d="M7.99219 14.25H12.5C14.571 14.25 16.25 12.571 16.25 10.5C16.25 9.26881 15.6525 8.18681 14.7351 7.50711"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
    </svg>
  ),
);
CloudOff.displayName = "CloudOff";
