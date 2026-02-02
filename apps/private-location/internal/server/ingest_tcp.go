package server

import (
	"context"
	"strconv"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

type TCPData struct {
	ID            string `json:"id"`
	Timing        string `json:"timing"`
	ErrorMessage  string `json:"errorMessage"`
	Region        string `json:"region"`
	Trigger       string `json:"trigger"`
	URI           string `json:"uri"`
	RequestStatus string `json:"requestStatus,omitempty"`

	RequestId     int64 `json:"requestId,omitempty"`
	WorkspaceID   int64 `json:"workspaceId"`
	MonitorID     int64 `json:"monitorId"`
	Timestamp     int64 `json:"timestamp"`
	Latency       int64 `json:"latency"`
	CronTimestamp int64 `json:"cronTimestamp"`

	Error uint8 `json:"error"`
}

func (h *privateLocationHandler) IngestTCP(ctx context.Context, req *connect.Request[private_locationv1.IngestTCPRequest]) (*connect.Response[private_locationv1.IngestTCPResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, ErrMissingToken)
	}

	if err := ValidateIngestTCPRequest(req.Msg); err != nil {
		return nil, NewValidationError(err)
	}

	ic, err := h.getIngestContext(ctx, token, req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// Enrich wide event with business context
	if holder := GetEvent(ctx); holder != nil {
		holder.Event["private_location"] = map[string]any{
			"monitor_id":   req.Msg.MonitorId,
			"workspace_id": ic.Monitor.WorkspaceID,
			"region_id":    ic.Region.ID,
			"datasource":   tinybird.DatasourceTCP,
		}
	}

	data := TCPData{
		ID:            req.Msg.Id,
		WorkspaceID:   int64(ic.Monitor.WorkspaceID),
		Timestamp:     req.Msg.Timestamp,
		Error:         uint8(req.Msg.Error),
		Region:        strconv.Itoa(ic.Region.ID),
		MonitorID:     int64(ic.Monitor.ID),
		Timing:        req.Msg.Timing,
		Latency:       req.Msg.Latency,
		CronTimestamp: req.Msg.CronTimestamp,
		Trigger:       "cron",
		URI:           req.Msg.Uri,
		RequestStatus: req.Msg.RequestStatus,
	}

	h.sendEventAndUpdateLastSeen(ctx, data, tinybird.DatasourceTCP, ic.Region.ID)

	return connect.NewResponse(&private_locationv1.IngestTCPResponse{}), nil
}
