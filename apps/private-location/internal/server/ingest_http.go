package server

import (
	"context"
	"strconv"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

type PingData struct {
	ID            string `json:"id"`
	WorkspaceID   string `json:"workspaceId"`
	MonitorID     string `json:"monitorId"`
	URL           string `json:"url"`
	Method        string `json:"method"`
	Region        string `json:"region"`
	Message       string `json:"message,omitempty"`
	Timing        string `json:"timing,omitempty"`
	Headers       string `json:"headers,omitempty"`
	Assertions    string `json:"assertions"`
	Body          string `json:"body,omitempty"`
	Trigger       string `json:"trigger,omitempty"`
	RequestStatus string `json:"requestStatus,omitempty"`
	Latency       int64  `json:"latency"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Timestamp     int64  `json:"timestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Error         uint8  `json:"error"`
}

func (h *privateLocationHandler) IngestHTTP(ctx context.Context, req *connect.Request[private_locationv1.IngestHTTPRequest]) (*connect.Response[private_locationv1.IngestHTTPResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, ErrMissingToken)
	}

	if err := ValidateIngestHTTPRequest(req.Msg); err != nil {
		return nil, NewValidationError(err)
	}

	ic, err := h.getIngestContext(ctx, token, req.Msg.MonitorId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	data := PingData{
		ID:            req.Msg.Id,
		Latency:       req.Msg.Latency,
		StatusCode:    int(req.Msg.StatusCode),
		MonitorID:     req.Msg.MonitorId,
		Region:        strconv.Itoa(ic.Region.ID),
		WorkspaceID:   strconv.Itoa(ic.Monitor.WorkspaceID),
		Timestamp:     req.Msg.Timestamp,
		CronTimestamp: req.Msg.CronTimestamp,
		URL:           ic.Monitor.URL,
		Method:        ic.Monitor.Method,
		Timing:        req.Msg.Timing,
		Headers:       req.Msg.Headers,
		Body:          req.Msg.Body,
		Trigger:       "cron",
		RequestStatus: req.Msg.RequestStatus,
		Assertions:    ic.Monitor.Assertions.String,
	}

	h.sendEventAndUpdateLastSeen(ctx, data, tinybird.DatasourceHTTP, ic.Region.ID)

	return connect.NewResponse(&private_locationv1.IngestHTTPResponse{}), nil
}
