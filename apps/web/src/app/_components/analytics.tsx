"use client";

import { Analytics } from "@vercel/analytics/react";

export const ClientAnalytics = () => {
  const getSubdomain = (url: string) => {
    let domain = url;
    if (url.includes("://")) {
      domain = url.split("://")[1];
    }
    const subdomain = domain.split(".")[0];
    return subdomain;
  };

  return (
    <Analytics
      beforeSend={(event) => {
        // Ignore all events that have a `/private` inside the URL
        if (event.url.match(/https:\/\/((?!www).*)\.openstatus\.dev/)) {
          return {
            ...event,
            url: `https://www.openstatus.dev/status-page/${getSubdomain(
              event.url,
            )}`,
          };
        }
        return event;
      }}
    />
  );
};
