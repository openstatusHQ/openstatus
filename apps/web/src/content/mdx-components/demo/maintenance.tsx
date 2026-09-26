import {
  StatusBannerContainer,
  StatusBannerContent,
} from "@openstatus/ui/components/blocks/status-banner";
import {
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventTimelineMaintenance,
} from "@openstatus/ui/components/blocks/status-events";

import { demo, getMaintenance } from "@/data/demo-data";

import { Cell, CellBody, CellFooter } from "./cell";

/** The banner the status page shows for a scheduled window, subscribers told first. */
export function MaintenanceDemo() {
  const maintenance = getMaintenance();
  return (
    <Cell>
      <CellBody>
        <StatusBannerContainer status="info">
          <StatusBannerContent>
            <StatusEventTimelineMaintenance
              maintenance={maintenance}
              withDot={false}
            />
            <StatusEventAffected>
              {maintenance.affected.map((name) => (
                <StatusEventAffectedBadge key={name}>
                  {name}
                </StatusEventAffectedBadge>
              ))}
            </StatusEventAffected>
          </StatusBannerContent>
        </StatusBannerContainer>
      </CellBody>
      <CellFooter>
        <span>
          Scheduled {Math.round(demo.maintenance.hoursFromNow / 24)} days ahead
        </span>
        <span>
          {demo.subscribers.email.toLocaleString("en-US")} subscribers notified
          at scheduling
        </span>
      </CellFooter>
    </Cell>
  );
}
