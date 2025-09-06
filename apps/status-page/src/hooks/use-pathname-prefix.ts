"use client";

import { useEffect, useState } from "react";

export function usePathnamePrefix() {
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostnames = window.location.hostname.split(".");
      const pathnames = window.location.pathname.split("/");
      if (
        hostnames.length > 2 &&
        hostnames[0] !== "www" &&
        !window.location.hostname.endsWith(".vercel.app")
      ) {
        setPrefix(hostnames[0]);
      } else {
        setPrefix(pathnames[1]);
      }
    }
  }, []);

  return prefix;
}
