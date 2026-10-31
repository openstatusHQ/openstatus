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
  href,
  title = "YouTube video",
}: {
  href: string;
  title?: string;
}) {
  const id = idOf(href);
  return (
    <div className="border-border relative my-4 aspect-video w-full overflow-hidden border [.grid>&]:my-0">
      {id ? (
        <YouTubeFacade
          embedUrl={toEmbedUrl(href)}
          thumbnailUrl={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          title={title}
        />
      ) : (
        <iframe
          src={href}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      )}
    </div>
  );
}
