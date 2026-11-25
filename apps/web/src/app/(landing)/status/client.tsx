"use client";

import { Suspense } from "react";

import {
  IssuesNow,
  PopularStatus,
  ServiceDirectory,
  StatusHeader,
  useIsStatusLanding,
} from "./sections";

export function Client() {
  const landing = useIsStatusLanding();
  return (
    <>
      <StatusHeader />
      {landing ? (
        <>
          <IssuesNow />
          {/* Prefetched only on the bare index; elsewhere it loads on its own. */}
          <Suspense fallback={null}>
            <PopularStatus />
          </Suspense>
        </>
      ) : null}
      <ServiceDirectory />
    </>
  );
}
