"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * Click-to-play YouTube embed: shows the thumbnail until the visitor asks for
 * the video, so the ~0.5 MB player only loads on demand.
 */
export function YouTubeFacade({
  embedUrl,
  thumbnailUrl,
  fallbackThumbnailUrl,
  title,
}: {
  embedUrl: string;
  /** Preferred thumbnail (maxresdefault, 1280x720). */
  thumbnailUrl: string;
  /** Used when the preferred one is missing (hqdefault always exists). */
  fallbackThumbnailUrl?: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState(thumbnailUrl);

  const showFallback = () => {
    if (fallbackThumbnailUrl && src !== fallbackThumbnailUrl) {
      setSrc(fallbackThumbnailUrl);
    }
  };

  if (playing) {
    return (
      <iframe
        src={`${embedUrl}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      className="group absolute inset-0 h-full w-full cursor-pointer"
    >
      {/* plain <img>: remote thumbnail, avoids a next/image remotePatterns change */}
      <img
        src={src}
        alt={title}
        // YouTube answers a missing maxresdefault with a 120x90 placeholder
        // (sometimes with a 404, sometimes not), so check the size too.
        onError={showFallback}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth <= 120) showFallback();
        }}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="bg-background/90 text-foreground border-border group-hover:bg-background group-focus-visible:ring-ring flex size-14 items-center justify-center rounded-full border shadow-sm transition-colors group-focus-visible:ring-2">
          <Play className="ml-0.5 size-6 fill-current" aria-hidden />
        </span>
      </span>
    </button>
  );
}
