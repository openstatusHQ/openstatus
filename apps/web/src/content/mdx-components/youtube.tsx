function toEmbedUrl(href: string): string {
  try {
    const url = new URL(href);
    if (url.pathname.startsWith("/embed/")) return href;
    const id =
      url.searchParams.get("v") ??
      (url.hostname === "youtu.be" ? url.pathname.slice(1) : null);
    return id ? `https://www.youtube.com/embed/${id}` : href;
  } catch {
    return href;
  }
}

export function ShowcaseYouTube({
  entries,
}: {
  entries: { href: string; title?: string }[];
}) {
  return (
    <div className="my-4 grid gap-4 sm:grid-cols-2">
      {entries.map((entry) => (
        <div
          key={entry.href}
          className="relative aspect-video w-full overflow-hidden border border-border"
        >
          <iframe
            src={toEmbedUrl(entry.href)}
            title={entry.title ?? "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      ))}
    </div>
  );
}
