"use client";

import { Tracker } from "@/components/tracker/tracker";
import { Checkbox } from "@openstatus/ui";
import { useState } from "react";
import { mockTrackerData } from "../mock";

export function TrackerWithVisibilityToggle() {
  const [visible, setVisible] = useState(true);
  return (
    <div className="flex flex-col gap-8 my-auto">
      <div className="items-top flex space-x-2">
        <Checkbox
          id="visibility"
          onCheckedChange={(e) => setVisible(!!e)}
          checked={visible}
        />
        <div className="grid gap-1.5 leading-none">
          <label
            htmlFor="visibility"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Show values
          </label>
          <p className="text-sm text-muted-foreground">
            Share the uptime and number of requests.
          </p>
        </div>
      </div>
      <Tracker
        data={mockTrackerData}
        name="OpenStatus"
        description="Website Health"
        showValues={visible}
      />
    </div>
  );
}
