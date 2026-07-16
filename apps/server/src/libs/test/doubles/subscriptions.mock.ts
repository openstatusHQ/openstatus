// Test double for @openstatus/subscriptions, swapped in via --import-map.
// Re-exports the real module, overriding only the dispatch fns and getChannel
// with spies (exposed on globalThis via state.ts) so route tests can assert
// notification side effects without sending anything.
export * from "@openstatus/subscriptions-real";

import { subscriptionSpies as spies } from "./state.ts";

export const dispatchStatusReportUpdate = spies.dispatchStatusReportUpdate;
export const dispatchMaintenanceUpdate = spies.dispatchMaintenanceUpdate;
export const getChannel = () => spies.getChannel;
