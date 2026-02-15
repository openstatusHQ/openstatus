package handlers

import (
	"context"

	"github.com/openstatushq/openstatus/apps/checker/checker"
)

// mapMonitorStatus converts a monitor status string to a request status string.
func mapMonitorStatus(status string) string {
	switch status {
	case "active":
		return "success"
	case "error":
		return "error"
	case "degraded":
		return "degraded"
	default:
		return ""
	}
}

// updateMonitorStatus evaluates whether the monitor status has changed and calls
// checker.UpdateStatus when needed. Returns the new requestStatus string.
func updateMonitorStatus(ctx context.Context, isSuccessful bool, latency, degradedAfter, cronTimestamp int64,
	currentStatus, monitorID, region string, statusCode int, message string) string {

	switch {
	case !isSuccessful && currentStatus != "error":
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     monitorID,
			Status:        "error",
			StatusCode:    statusCode,
			Region:        region,
			Message:       message,
			CronTimestamp: cronTimestamp,
			Latency:       latency,
		})
		return "error"

	case isSuccessful && degradedAfter > 0 && latency > degradedAfter && currentStatus != "degraded":
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     monitorID,
			Status:        "degraded",
			Region:        region,
			StatusCode:    statusCode,
			CronTimestamp: cronTimestamp,
			Latency:       latency,
		})
		return "degraded"

	case isSuccessful && currentStatus != "active":
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     monitorID,
			Status:        "active",
			Region:        region,
			StatusCode:    statusCode,
			CronTimestamp: cronTimestamp,
			Latency:       latency,
		})
		return "success"

	default:
		return ""
	}
}
