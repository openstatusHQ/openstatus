"use client";

import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_DOMAIN,
  ATTRIBUTION_MAX_AGE,
  type Attribution,
  serializeAttribution,
} from "@openstatus/analytics/src/attribution";
import { useEffect } from "react";

const PARAMS = ["ref", "utm_source", "utm_medium", "utm_campaign"] as const;

function referrerHost(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).hostname;
    return host.endsWith("openstatus.dev") ? undefined : host;
  } catch {
    return undefined;
  }
}

// First touch wins: an existing cookie is left alone so the landing page that
// brought the visitor here survives later navigation and the app hand-off.
export function Attribution() {
  useEffect(() => {
    try {
      const present = document.cookie
        .split(";")
        .some((part) => part.trim().startsWith(`${ATTRIBUTION_COOKIE}=`));
      if (present) return;

      const params = new URLSearchParams(window.location.search);
      const attribution: Attribution = {
        landing_path: window.location.pathname,
        landing_referrer: referrerHost(),
      };
      for (const key of PARAMS) {
        const value = params.get(key);
        if (value) attribution[key] = value;
      }

      const onProd = window.location.hostname.endsWith(
        ATTRIBUTION_DOMAIN.slice(1),
      );
      const scope = onProd ? `; domain=${ATTRIBUTION_DOMAIN}; secure` : "";
      document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(
        serializeAttribution(attribution),
      )}; path=/; max-age=${ATTRIBUTION_MAX_AGE}; samesite=lax${scope}`;
    } catch {
      // Cookies blocked: attribution is best effort.
    }
  }, []);

  return null;
}
