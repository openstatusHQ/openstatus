import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (PaperPlane); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Send = forwardRef<SVGSVGElement, IconProps>(
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
        d="M5.75,10.022v4.246c0,.409,.464,.645,.794,.404l.74-.539"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></path>
      <line
        x1="15.58"
        y1="2.569"
        x2="5.75"
        y2="10.022"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        data-color="color-2"
      ></line>
      <path
        d="M2.883,6.935L15.182,2.542c.363-.13,.73,.183,.66,.562l-2.196,11.86c-.067,.363-.492,.531-.789,.311L2.754,7.807c-.322-.238-.248-.738,.129-.873Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      ></path>
    </svg>
  ),
);
Send.displayName = "Send";
