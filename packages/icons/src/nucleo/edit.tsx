import { forwardRef } from "react";

import type { IconProps } from "../types";

// from nucleo-ui-outline-18 (Pencil); 18px grid, so the 1.5 stroke renders as 2px at size 24
export const Edit = forwardRef<SVGSVGElement, IconProps>(
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
        d="M13.953 7.57799L15.062 6.46898C15.648 5.88298 15.648 4.93298 15.062 4.34798L13.653 2.93898C13.067 2.35298 12.117 2.35298 11.532 2.93898L10.423 4.04799L13.953 7.57799Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      ></path>
      <path
        d="M8.6544 5.81461L4.147 10.322C3.897 10.572 3.718 10.884 3.627 11.226L2.5 15.499L6.773 14.372C7.115 14.282 7.427 14.102 7.677 13.852L12.1844 9.3446"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
      <path
        d="M10.4044 7.56461L6.26501 11.704"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      ></path>
    </svg>
  ),
);
Edit.displayName = "Edit";
