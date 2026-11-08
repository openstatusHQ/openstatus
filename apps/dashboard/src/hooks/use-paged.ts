import { useState } from "react";

/** The first `size` items, growing by `size` on each `showMore`. */
export function usePaged<T>(items: T[], size = 10) {
  const [limit, setLimit] = useState(size);
  return {
    visible: items.slice(0, limit),
    hasMore: items.length > limit,
    showMore: () => setLimit((current) => current + size),
  };
}
