import type { ConnectError } from "@connectrpc/connect";

import { idRequiredError } from "../../errors";

export { invalidDateFormatError } from "../../errors";

export function maintenanceIdRequiredError(): ConnectError {
  return idRequiredError("Maintenance");
}
