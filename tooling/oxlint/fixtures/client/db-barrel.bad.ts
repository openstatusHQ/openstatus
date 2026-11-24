"use client";

import { monitor } from "@openstatus/db/src/schema"; // expect: no-db-barrel-in-client
import { type Page, page } from "@openstatus/db/src/schema"; // expect: no-db-barrel-in-client
import "@openstatus/db/src/schema"; // expect: no-db-barrel-in-client

export const used = [monitor, page] as unknown as Page[];
