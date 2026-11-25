import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (CalendarClock); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Schedule = forwardRef<SVGSVGElement, IconProps>(
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
        d="m5.75,3.25V1.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="m12.25,3.25V1.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="m2.25,6.75h13.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="m15.75,8.0625v-2.8125c0-1.104-.895-2-2-2H4.25c-1.105,0-2,.896-2,2v8.5c0,1.104.895,2,2,2h3.7496"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
      <path
        d="m14,10c-2.2061,0-4,1.7944-4,4s1.7939,4,4,4,4-1.7944,4-4-1.7939-4-4-4Zm2.3125,4.9502c-.1191.2896-.3984.4648-.6934.4648-.0957,0-.1914-.0181-.2852-.0562l-1.6191-.665c-.2812-.1157-.4648-.3896-.4648-.6938v-1.75c0-.4141.3359-.75.75-.75s.75.3359.75.75v1.2471l1.1543.4741c.3828.1572.5664.5957.4082.979Z"
        fill="currentColor"
        strokeWidth="0"
        data-color="color-2"
      ></path>
    </svg>
  ),
);
Schedule.displayName = "Schedule";
