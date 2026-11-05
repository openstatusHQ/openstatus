import {
  StatusBannerContainer,
  StatusBannerIcon,
  StatusBannerMessage,
} from "@openstatus/ui/components/blocks/status-banner";
import type { StatusType } from "@openstatus/ui/components/blocks/status.types";

/** The page banner at demo size: icon and message on one line. */
export function DemoBanner({
  status,
}: {
  status: Exclude<StatusType, "empty">;
}) {
  return (
    <StatusBannerContainer
      status={status}
      className="flex items-center gap-3 px-3 py-2"
    >
      <StatusBannerIcon className="shrink-0" />
      <StatusBannerMessage className="font-semibold" />
    </StatusBannerContainer>
  );
}
