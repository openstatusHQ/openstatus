import * as React from "react";
import Link from "next/link";
import type { TweetProps } from "react-tweet";
import { Tweet } from "react-tweet";

export const components = {
  a: ({
    href = "",
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href.startsWith("http")) {
      return (
        <a
          className="text-foreground underline underline-offset-4 hover:no-underline"
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
        className="text-foreground underline underline-offset-4 hover:no-underline"
        {...props}
      />
    );
  },
  Tweet: (props: TweetProps) => {
    return (
      <div data-theme="light" className="not-prose [&>div]:mx-auto">
        <Tweet {...props} />
      </div>
    );
  },
};
