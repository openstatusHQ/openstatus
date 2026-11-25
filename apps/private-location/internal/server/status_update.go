package server

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"github.com/openstatushq/openstatus/apps/private-location/internal/workflows"
)

type statusUpdateInput struct {
	RequestStatus string
	Message       string
	Latency       int64
	CronTimestamp int64
	StatusCode    int
	ErrorFlag     uint8
}

func classifyStatus(requestStatus string, errorFlag uint8) string {
	switch requestStatus {
	case "success", "active":
		return "active"
	case "degraded":
		return "degraded"
	case "error":
		return "error"
	default:
		if errorFlag == 1 {
			return "error"
		}
		return "active"
	}
}

func (h *privateLocationHandler) forwardStatusUpdate(ctx context.Context, ic *ingestContext, input statusUpdateInput) {
	if h.WorkflowsClient == nil {
		return
	}

	payload := workflows.Payload{
		MonitorID:         strconv.Itoa(ic.Monitor.ID),
		PrivateLocationID: strconv.Itoa(ic.Region.ID),
		Status:            classifyStatus(input.RequestStatus, input.ErrorFlag),
		Message:           input.Message,
		CronTimestamp:     input.CronTimestamp,
		Latency:           input.Latency,
		StatusCode:        input.StatusCode,
	}

	// Detached from the ingest RPC: a lost report self-heals on the next check.
	go func() {
		detachedCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if err := h.WorkflowsClient.Report(detachedCtx, payload); err != nil {
			slog.Error("failed to forward status update to workflows",
				"monitor_id", payload.MonitorID,
				"private_location_id", payload.PrivateLocationID,
				"error", err.Error(),
			)
		}
	}()
}
