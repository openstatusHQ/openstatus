package server

import (
	"context"
	"strconv"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

type ICMPData struct {
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
	LatencyMin    int64 `json:"latencyMin"`
	LatencyMax    int64 `json:"latencyMax"`
	CronTimestamp int64 `json:"cronTimestamp"`

	PacketsSent     uint8 `json:"packetsSent"`
	PacketsReceived uint8 `json:"packetsReceived"`

	Error uint8 `json:"error"`
}

func (h *privateLocationHandler) IngestICMP(ctx context.Context, req *connect.Request[private_locationv1.IngestICMPRequest]) (*connect.Response[private_locationv1.IngestICMPResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, ErrMissingToken)
	}

	if err := ValidateIngestICMPRequest(req.Msg); err != nil {
		return nil, NewValidationError(err)
	}

	ic, err := h.getIngestContext(ctx, token, req.Msg.MonitorId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// Enrich wide event with business context
	if holder := GetEvent(ctx); holder != nil {
		holder.Event["private_location"] = map[string]any{
			"monitor_id":   req.Msg.MonitorId,
			"workspace_id": ic.Monitor.WorkspaceID,
			"region_id":    ic.Region.ID,
			"datasource":   tinybird.DatasourceICMP,
		}
	}

	data := ICMPData{
		ID:              req.Msg.Id,
		WorkspaceID:     int64(ic.Monitor.WorkspaceID),
		Timestamp:       req.Msg.Timestamp,
		Error:           uint8(req.Msg.Error),
		Region:          strconv.Itoa(ic.Region.ID),
		MonitorID:       int64(ic.Monitor.ID),
		Timing:          req.Msg.Timing,
		Latency:         req.Msg.Latency,
		LatencyMin:      req.Msg.LatencyMin,
		LatencyMax:      req.Msg.LatencyMax,
		PacketsSent:     uint8(req.Msg.PacketsSent),
		PacketsReceived: uint8(req.Msg.PacketsReceived),
		CronTimestamp:   req.Msg.CronTimestamp,
		Trigger:         "cron",
		URI:             req.Msg.Uri,
		RequestStatus:   req.Msg.RequestStatus,
	}

	h.sendEventAndUpdateLastSeen(ctx, data, tinybird.DatasourceICMP, ic.Region.ID)

	h.forwardStatusUpdate(ctx, ic, statusUpdateInput{
		RequestStatus: data.RequestStatus,
		Message:       data.ErrorMessage,
		Latency:       data.Latency,
		CronTimestamp: data.CronTimestamp,
		ErrorFlag:     data.Error,
	})

	return connect.NewResponse(&private_locationv1.IngestICMPResponse{}), nil
}
