import { allChangelogs } from "contentlayer/generated";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@openstatus/ui";

const lastChangelog = allChangelogs
  .sort(
    (a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  )
  .pop();

export function ChangelogViewedButton() {
  const [show, setShow] = useState(false);

  function onClick() {
    if (document) {
      const date = new Date().toISOString();
      // store the last viewed changelog date in a cookie
      document.cookie = `last-viewed-changelog=${date}; path=/`;
    }
    setShow(false);
  }

  useEffect(() => {
    if (document) {
      const cookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("last-viewed-changelog"));
      if (!cookie) {
        setShow(true);
        return;
      }
      const lastViewed = new Date(cookie.split("=")[1]);
      if (lastChangelog && lastViewed < new Date(lastChangelog.publishedAt)) {
        setShow(true);
      }
    }
  }, []);

  return (
    <Button variant="link" asChild>
      <Link
        href="/changelog"
        target="_blank"
        onClick={onClick}
        className="relative"
      >
        Changelog
        {show ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-500" />
        ) : null}
      </Link>
    </Button>
  );
}
