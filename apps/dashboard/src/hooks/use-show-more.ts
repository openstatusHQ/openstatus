import { useState } from "react";

/** The first `step` items, growing by `step` on `showMore`; `hasMore` while some stay hidden. */
export function useShowMore<T>(items: T[], step = 50) {
  const [count, setCount] = useState(step);
  return {
    visible: items.slice(0, count),
    hasMore: items.length > count,
    showMore: () => setCount((c) => c + step),
  };
}
