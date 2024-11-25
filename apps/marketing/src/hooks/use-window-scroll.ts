// Props: https://github.com/uidotdev/usehooks/blob/90fbbb4cc085e74e50c36a62a5759a40c62bb98e/index.js#L1310

import * as React from "react";

export function useWindowScroll() {
  const [state, setState] = React.useState<{
    x: number | null;
    y: number | null;
  }>({
    x: null,
    y: null,
  });

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const scrollTo = React.useCallback((...args: any[]) => {
    if (typeof args[0] === "object") {
      window.scrollTo(args[0]);
    } else if (typeof args[0] === "number" && typeof args[1] === "number") {
      window.scrollTo(args[0], args[1]);
    } else {
      throw new Error(
        "Invalid arguments passed to scrollTo. See here for more info. https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo",
      );
    }
  }, []);

  React.useLayoutEffect(() => {
    const handleScroll = () => {
      setState({ x: window.scrollX, y: window.scrollY });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return [state, scrollTo] as const;
}
