import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-fill-12 (ShareUpRight); filled glyph, so strokeWidth has no effect
export const ExternalLink = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 24, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      style={{ flexShrink: 0 }}
      {...props}
    >
      <path
        d="m8.75,11.5H3.25c-1.517,0-2.75-1.233-2.75-2.75V3.25C.5,1.733,1.733.5,3.25.5h1.25c.414,0,.75.336.75.75s-.336.75-.75.75h-1.25c-.689,0-1.25.561-1.25,1.25v5.5c0,.689.561,1.25,1.25,1.25h5.5c.689,0,1.25-.561,1.25-1.25v-1.25c0-.414.336-.75.75-.75s.75.336.75.75v1.25c0,1.517-1.233,2.75-2.75,2.75Z"
        strokeWidth="0"
        fill="currentColor"
      ></path>
      <path
        d="m10.75.5h-3.75c-.414,0-.75.336-.75.75s.336.75.75.75h1.939l-2.202,2.202c-.293.293-.293.768,0,1.061.146.146.338.22.53.22s.384-.073.53-.22l2.202-2.202v1.939c0,.414.336.75.75.75s.75-.336.75-.75V1.25c0-.414-.336-.75-.75-.75Z"
        fill="currentColor"
        strokeWidth="0"
        data-color="color-2"
      ></path>
    </svg>
  ),
);
ExternalLink.displayName = "ExternalLink";
