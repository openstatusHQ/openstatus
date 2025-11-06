"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export function usePathnamePrefix() {
  const trpc = useTRPC();
  const { domain } = useParams<{ domain: string }>();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostnames = window.location.hostname.split(".");
      const pathnames = window.location.pathname.split("/");
      const isCustomDomain = window.location.hostname === page?.customDomain;

      if (
        isCustomDomain ||
        (hostnames.length > 2 &&
          hostnames[0] !== "www" &&
          !window.location.hostname.endsWith(".vercel.app"))
      ) {
        setPrefix("");
      } else {
        setPrefix(pathnames[1]);
      }
    }
  }, [page?.customDomain]);

  return prefix;
}
