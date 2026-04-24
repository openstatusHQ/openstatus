import type { ServiceImpl } from "@connectrpc/connect";
import {
  CheckResponse_ServingStatus,
  type HealthService,
} from "@openstatus/proto/health/v1";

/**
 * Health service implementation.
 * Provides a simple health check endpoint for load balancer probes.
 */
export const healthServiceImpl: ServiceImpl<typeof HealthService> = {
  async check(_req) {
    return {
      status: CheckResponse_ServingStatus.SERVING,
    };
  },
};
