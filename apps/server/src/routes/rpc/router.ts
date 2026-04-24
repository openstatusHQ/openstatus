import { createConnectRouter } from "@connectrpc/connect";
import { HealthService } from "@openstatus/proto/health/v1";
import { MaintenanceService } from "@openstatus/proto/maintenance/v1";
import { MonitorService } from "@openstatus/proto/monitor/v1";
import { NotificationService } from "@openstatus/proto/notification/v1";
import { StatusPageService } from "@openstatus/proto/status_page/v1";
import { StatusReportService } from "@openstatus/proto/status_report/v1";

import { healthServiceImpl } from "./handlers/health";
import { maintenanceServiceImpl } from "./handlers/maintenance";
import { monitorServiceImpl } from "./handlers/monitor";
import { notificationServiceImpl } from "./handlers/notification";
import { statusPageServiceImpl } from "./handlers/status-page";
import { statusReportServiceImpl } from "./handlers/status-report";
import {
  authInterceptor,
  errorInterceptor,
  loggingInterceptor,
  trackingInterceptor,
  validationInterceptor,
} from "./interceptors";

/**
 * Create ConnectRPC router with services.
 * Interceptors are applied in order (outermost to innermost):
 * 1. errorInterceptor - Catches all errors and maps to ConnectError
 * 2. loggingInterceptor - Logs requests/responses with duration
 * 3. authInterceptor - Validates API key and sets workspace context
 * 4. validationInterceptor - Validates request messages using protovalidate
 * 5. trackingInterceptor - Fires OpenPanel events on success
 */
export const routes = createConnectRouter({
  interceptors: [
    errorInterceptor(),
    loggingInterceptor(),
    authInterceptor(),
    validationInterceptor(),
    trackingInterceptor(),
  ],
})
  .service(MonitorService, monitorServiceImpl)
  .service(HealthService, healthServiceImpl)
  .service(StatusReportService, statusReportServiceImpl)
  .service(StatusPageService, statusPageServiceImpl)
  .service(MaintenanceService, maintenanceServiceImpl)
  .service(NotificationService, notificationServiceImpl);
