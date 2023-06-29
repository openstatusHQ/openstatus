"use client";

import React from "react";
import { EventTable } from "./event-table";
import { InputSearch } from "./input-search";

// TODO: once stable, use the shallow route to store the search params inside of the search params

export function TableInputContainer({
  events,
}: {
  // FIXME: should be return type
  events: {
    id: string;
    timestamp: number;
    statusCode: number;
    latency: number;
    url: string;
  }[];
}) {
  const [search, setSearch] = React.useState<Record<string, string>>({});

  const filteredEvents = events
    .filter((event) => {
      const url = new URL(event.url);
      if (search?.status && event.statusCode !== Number(search.status)) {
        return false;
      } else if (search?.pathname && url.pathname !== search.pathname) {
        return false;
      }
      return true;
    })
    .slice(0, search.limit ? Number(search.limit) : 100);

  return (
    <>
      <InputSearch events={events} onSearch={setSearch} />
      <EventTable events={filteredEvents} />
    </>
  );
}
