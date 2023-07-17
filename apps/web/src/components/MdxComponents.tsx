import React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const LINK_STYLES =
  "dark:dark:text-gray-100/90 underline dark:decoration-gray-200/30 decoration-blue-200/30 underline-offset-2 transition-all dark:hover:text-gray-100 dark:hover:decoration-gray-200/50";
const FOCUS_VISIBLE_OUTLINE =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/70";

export const components = {
  h1: (props: any) => (
    <h2
      className="relative mt-3 text-xl font-medium dark:text-gray-100/90 sm:text-3xl"
      {...props}
    />
  ),
  h2: (props: any) => (
    <h3
      className="relative mt-3 text-xl font-medium dark:text-gray-100/90 sm:text-2xl"
      {...props}
    />
  ),
  h3: (props: any) => (
    <h4 className="text-xl font-medium dark:text-gray-100/90" {...props} />
  ),
  h4: (props: any) => (
    <h5 className="text-lg font-medium dark:text-gray-100/90" {...props} />
  ),
  hr: (props: any) => <hr className="relative pt-9 sm:pt-10" {...props} />,
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
  ul: (props: any) => (
    <ul
      className="space-y-3 before:[&>li]:bg-gray-700 dark:before:[&>li]:bg-gray-100/20 [li>&]:mt-3"
      {...props}
    />
  ),
  ol: (props: any) => (
    <ol
      className="ml-4 list-decimal space-y-3 text-sm sm:ml-7 md:text-base [li>&]:mt-3"
      {...props}
    />
  ),
  strong: (props: any) => <strong className="font-semibold" {...props} />,

  blockquote: (props: any) => (
    <blockquote
      className="border-l-2 border-gray-700 pl-4 text-xl italic dark:border-gray-200/10 xl:!col-start-2 xl:!col-end-3"
      {...props}
    />
  ),
  del: (props: any) => (
    <del className="text-gray-100/70 line-through" {...props} />
  ),
};
