"use client";

import type { Monitor } from "@openstatus/db/src/schema";
import { type Page } from "@openstatus/db/src/schema";
import { monitorRegions } from "@openstatus/db/src/schema/constants";

export const used: [Monitor[], Page[], typeof monitorRegions] = [[], [], monitorRegions];
