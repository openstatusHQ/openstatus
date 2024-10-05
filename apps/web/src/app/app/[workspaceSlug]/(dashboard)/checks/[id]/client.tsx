"use client";

import { useQueryStates } from "nuqs";
import { useEffect } from "react";
import { searchParamsParsers } from "./search-params";

export function Client({ totalRows }: { totalRows: number }) {
  const [search, setSearch] = useQueryStates(searchParamsParsers);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function onScroll() {
      // TODO: add a threshold for the "Load More" button
      const onPageBottom =
        window.innerHeight + Math.round(window.scrollY) >=
        document.body.offsetHeight;
      if (onPageBottom && search.pageSize * search.page <= totalRows) {
        setSearch(
          {
            // page: search.page + 1
            pageSize: search.pageSize + 10,
          },
          { shallow: false },
        );
      }
    }

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [search, setSearch, totalRows]);

  return null;
}
