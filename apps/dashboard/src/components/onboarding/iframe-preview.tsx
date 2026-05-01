"use client";

import { cn } from "@/lib/utils";

const STATUS_PAGE_DOMAIN =
  process.env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN ?? "openstatus.dev";

/** Slug used as the placeholder iframe behind the onboarding scrim. */
export const DEMO_PREVIEW_SLUG = "hello-world";

export function StatusPageIframePreview({
  slug,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { slug: string }) {
  const url = `https://${slug}.${STATUS_PAGE_DOMAIN}`;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 md:min-h-0 md:flex-1",
        className,
      )}
      {...props}
    >
      <div className="flex h-[calc(100dvh-13rem)] overflow-hidden rounded-md border border-border bg-background md:h-auto md:min-h-0 md:flex-1">
        <iframe
          src={url}
          title={`${slug} status page preview`}
          className="block h-full w-full origin-top-left"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
