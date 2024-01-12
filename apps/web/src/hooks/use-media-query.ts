import { useEffect, useState } from "react";

type MediaQuery = string | number;

export function useMediaQuery(query: MediaQuery): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(String(query));

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Initial check
    setMatches(mediaQueryList.matches);

    // Add listener for changes
    mediaQueryList.addEventListener("change", handleChange);

    // Clean up listener on unmount
    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}
