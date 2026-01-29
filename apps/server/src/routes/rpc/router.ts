import { createConnectRouter } from "@connectrpc/connect";
import { HealthService } from "@openstatus/proto/health/v1";
import { MonitorService } from "@openstatus/proto/monitor/v1";
import { StatusPageService } from "@openstatus/proto/status_page/v1";
import { StatusReportService } from "@openstatus/proto/status_report/v1";

import {
  authInterceptor,
  errorInterceptor,
  loggingInterceptor,
  validationInterceptor,
} from "./interceptors";
import { healthServiceImpl } from "./services/health";
import { monitorServiceImpl } from "./services/monitor";
import { statusPageServiceImpl } from "./services/status-page";
import { statusReportServiceImpl } from "./services/status-report";

/**
 * Create ConnectRPC router with services.
 * Interceptors are applied in order (outermost to innermost):
 * 1. errorInterceptor - Catches all errors and maps to ConnectError
 * 2. loggingInterceptor - Logs requests/responses with duration
 * 3. authInterceptor - Validates API key and sets workspace context
 * 4. validationInterceptor - Validates request messages using protovalidate
 */
export const routes = createConnectRouter({
  interceptors: [
    errorInterceptor(),
    loggingInterceptor(),
    authInterceptor(),
    validationInterceptor(),
  ],
})
  .service(MonitorService, monitorServiceImpl)
  .service(HealthService, healthServiceImpl)
  .service(StatusReportService, statusReportServiceImpl)
  .service(StatusPageService, statusPageServiceImpl);
