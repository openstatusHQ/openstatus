import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (BookOpen); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const BookOpen = forwardRef<SVGSVGElement, IconProps>(
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
        d="M9,15.051c.17,0,.339-.045,.494-.134,.643-.371,1.732-.847,3.141-.845,.899,.001,1.667,.197,2.27,.435,.648,.255,1.344-.24,1.344-.937V4.487c0-.354-.181-.68-.486-.86-.637-.376-1.726-.863-3.14-.863-1.89,0-3.198,.872-3.624,1.182"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></path>
      <path
        d="M9,15.051c-.17,0-.339-.045-.494-.134-.643-.371-1.732-.847-3.141-.845-.899,.001-1.667,.197-2.27,.435-.648,.255-1.344-.237-1.344-.933,0-2.593,0-7.472,0-9.09,0-.354,.181-.676,.486-.856,.637-.376,1.726-.863,3.14-.863,1.89,0,3.198,.872,3.624,1.182h0s0,11.104,0,11.104Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
    </svg>
  ),
);
BookOpen.displayName = "BookOpen";
