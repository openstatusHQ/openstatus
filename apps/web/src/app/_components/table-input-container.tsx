"use client";

import React from "react";

import type { Ping } from "@openstatus/tinybird";

import { EventTable } from "./event-table";
import { InputSearch } from "./input-search";

// TODO: once stable, use the shallow route to store the search params inside of the search params

export function TableInputContainer({ events }: { events: Ping[] }) {
  const [search, setSearch] = React.useState<Record<string, string>>({});

  const filteredEvents = events
    .filter((event) => {
      if (search?.status && event.statusCode !== Number(search.status)) {
        return false;
        // biome-ignore lint/style/noUselessElse:
      } else if (search?.region && event.region !== search.region) {
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
