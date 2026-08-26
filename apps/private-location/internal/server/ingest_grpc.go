package server

import (
	"context"
	"strconv"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

type GRPCData struct {
	ID            string `json:"id"`
	Timing        string `json:"timing"`
	ErrorMessage  string `json:"errorMessage"`
	Region        string `json:"region"`
	Trigger       string `json:"trigger"`
	URI           string `json:"uri"`
	Service       string `json:"service,omitempty"`
	ServingStatus string `json:"servingStatus,omitempty"`
	RequestStatus string `json:"requestStatus,omitempty"`

	RequestId     int64 `json:"requestId,omitempty"`
	WorkspaceID   int64 `json:"workspaceId"`
	MonitorID     int64 `json:"monitorId"`
	Timestamp     int64 `json:"timestamp"`
	Latency       int64 `json:"latency"`
	CronTimestamp int64 `json:"cronTimestamp"`
	GRPCCode      int64 `json:"grpcCode"`

	Error uint8 `json:"error"`
}

func (h *privateLocationHandler) IngestGRPC(ctx context.Context, req *connect.Request[private_locationv1.IngestGRPCRequest]) (*connect.Response[private_locationv1.IngestGRPCResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, ErrMissingToken)
	}

	if err := ValidateIngestGRPCRequest(req.Msg); err != nil {
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
			"datasource":   tinybird.DatasourceGRPC,
		}
	}

	data := GRPCData{
		ID:            req.Msg.Id,
		WorkspaceID:   int64(ic.Monitor.WorkspaceID),
		Timestamp:     req.Msg.Timestamp,
		Error:         uint8(req.Msg.Error),
		ErrorMessage:  req.Msg.Message,
		Region:        strconv.Itoa(ic.Region.ID),
		MonitorID:     int64(ic.Monitor.ID),
		Timing:        req.Msg.Timing,
		Latency:       req.Msg.Latency,
		GRPCCode:      req.Msg.GrpcCode,
		ServingStatus: req.Msg.ServingStatus,
		Service:       req.Msg.Service,
		CronTimestamp: req.Msg.CronTimestamp,
		Trigger:       "cron",
		URI:           req.Msg.Uri,
		RequestStatus: req.Msg.RequestStatus,
	}

	h.sendEventAndUpdateLastSeen(ctx, data, tinybird.DatasourceGRPC, ic.Region.ID)

	h.forwardStatusUpdate(ctx, ic, statusUpdateInput{
		RequestStatus: data.RequestStatus,
		Message:       data.ErrorMessage,
		Latency:       data.Latency,
		CronTimestamp: data.CronTimestamp,
		ErrorFlag:     data.Error,
	})

	return connect.NewResponse(&private_locationv1.IngestGRPCResponse{}), nil
}
