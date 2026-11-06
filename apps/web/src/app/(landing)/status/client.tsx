"use client";

import {
  IssuesNow,
  PopularComponents,
  PopularServices,
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
          <PopularServices />
          <PopularComponents />
        </>
      ) : null}
      <ServiceDirectory />
    </>
  );
}
