"use client";

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
          <PopularStatus />
        </>
      ) : null}
      <ServiceDirectory />
    </>
  );
}
