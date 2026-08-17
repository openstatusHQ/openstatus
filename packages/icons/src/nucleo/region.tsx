import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (MapPin); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Region = forwardRef<SVGSVGElement, IconProps>(
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
        d="M14.5 14.25C14.9142 14.25 15.25 13.914 15.25 13.5C15.25 13.086 14.9142 12.75 14.5 12.75C14.0858 12.75 13.75 13.086 13.75 13.5C13.75 13.914 14.0858 14.25 14.5 14.25Z"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></path>
      <path
        d="M16.25 8.0244V4.9971C16.25 4.357 15.658 3.8821 15.033 4.021L12.035 4.687C11.849 4.728 11.655 4.71609 11.476 4.65089L6.524 2.8501C6.345 2.7849 6.151 2.77199 5.965 2.81399L2.533 3.5769C2.075 3.679 1.75 4.08499 1.75 4.55299V13.003C1.75 13.6431 2.342 14.118 2.967 13.9791L5.965 13.3131C6.151 13.2721 6.345 13.284 6.524 13.3492L8.7912 14.1732"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M14.5 17.25C14.5 17.25 11.75 15.741 11.75 13.5C11.75 11.981 12.981 10.75 14.5 10.75C16.019 10.75 17.25 11.981 17.25 13.5C17.25 15.741 14.5 17.25 14.5 17.25Z"
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
Region.displayName = "Region";
