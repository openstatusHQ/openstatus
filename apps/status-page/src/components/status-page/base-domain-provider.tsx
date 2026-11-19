"use client";

import { createContext, useContext } from "react";

import { DEFAULT_STATUS_PAGE_BASE_DOMAIN } from "../../lib/base-domain";

// `STATUS_PAGE_BASE_DOMAIN` is a runtime server env (images are prebuilt), so
// client components cannot read it from `process.env`; the server layout reads
// it and hands it down through this context.
const BaseDomainContext = createContext<string>(
  DEFAULT_STATUS_PAGE_BASE_DOMAIN,
);

export function BaseDomainProvider({
  baseDomain,
  children,
}: {
  baseDomain: string;
  children: React.ReactNode;
}) {
  return (
    <BaseDomainContext.Provider value={baseDomain}>
      {children}
    </BaseDomainContext.Provider>
  );
}

export function useStatusPageBaseDomain() {
  return useContext(BaseDomainContext);
}
