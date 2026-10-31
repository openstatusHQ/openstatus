import { cn } from "@/lib/utils";

import { YouTubeFacade } from "./youtube-facade";

/** Extracts the video id from a watch, youtu.be or embed URL. */
function idOf(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.slice("/embed/".length).split("/")[0] || null;
    }
    return (
      url.searchParams.get("v") ??
      (url.hostname === "youtu.be" ? url.pathname.slice(1) || null : null)
    );
  } catch {
    return null;
  }
}

function toEmbedUrl(href: string): string {
  const id = idOf(href);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : href;
}

export function ShowcaseYouTube({
  entries,
}: {
  entries: { href: string; title?: string }[];
}) {
  return (
    <div
      className={cn("my-4 grid gap-4", entries.length > 1 && "sm:grid-cols-2")}
    >
      {entries.map((entry, i) => {
        const id = idOf(entry.href);
        const title = entry.title ?? "YouTube video";
        return (
          <div
            key={`${entry.href}-${i}`}
            className="border-border relative aspect-video w-full overflow-hidden border"
          >
            {id ? (
              <YouTubeFacade
                embedUrl={toEmbedUrl(entry.href)}
                thumbnailUrl={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                title={title}
              />
            ) : (
              <iframe
                src={entry.href}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="lazy"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
