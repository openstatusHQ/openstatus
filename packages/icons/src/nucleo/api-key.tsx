import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Key); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const ApiKey = forwardRef<SVGSVGElement, IconProps>(
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
        d="M6.64636 12.3536C6.64636 12.9056 6.19866 13.3536 5.64636 13.3536C5.09406 13.3536 4.64636 12.9056 4.64636 12.3536C4.64636 11.8016 5.09406 11.3536 5.64636 11.3536C6.19866 11.3536 6.64636 11.8016 6.64636 12.3536Z"
        fill="currentColor"
        data-color="color-2"
        data-stroke="none"
      ></path>
      <path
        d="M12.4216 2.75L7.27299 7.8984C6.9446 7.8112 6.6059 7.75 6.25 7.75C4.0408 7.75 2.25 9.5408 2.25 11.75C2.25 13.9592 4.0408 15.75 6.25 15.75C8.4592 15.75 10.25 13.959 10.25 11.75C10.25 11.394 10.1887 11.0554 10.1014 10.7271L12.25 8.5789V6.5074H14.321L15.25 5.5784V2.75H12.4216Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
    </svg>
  ),
);
ApiKey.displayName = "ApiKey";
