import React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const LINK_STYLES =
  "dark:dark:text-gray-100/90 underline dark:decoration-gray-200/30 decoration-blue-200/30 underline-offset-2 transition-all dark:hover:text-gray-100 dark:hover:decoration-gray-200/50";
const FOCUS_VISIBLE_OUTLINE =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/70";

export const components = {
  a: ({ href = "", ...props }) => {
    if (href.startsWith("http")) {
      return (
        <a
          className={cn(LINK_STYLES, FOCUS_VISIBLE_OUTLINE)}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        />
      );
    }

    return (
      <Link
        href={href}
        className={cn(LINK_STYLES, FOCUS_VISIBLE_OUTLINE)}
        {...props}
      />
    );
  },
};
