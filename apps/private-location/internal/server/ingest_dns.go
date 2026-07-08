package server

import (
	"context"
	"encoding/json"
	"strconv"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

type DNSResponse struct {
	ID            string `json:"id"`
	Timing        string `json:"timing"`
	ErrorMessage  string `json:"errorMessage"`
	Region        string `json:"region"`
	Trigger       string `json:"trigger"`
	URI           string `json:"uri"`
	RequestStatus string `json:"requestStatus,omitempty"`
	// JSON-encoded map so Tinybird stores it in the single `records` String
	// column instead of auto-flattening into quarantined records_* columns.
	Records string `json:"records"`

	RequestId     int64 `json:"requestId,omitempty"`
	WorkspaceID   int64 `json:"workspaceId"`
	MonitorID     int64 `json:"monitorId"`
	Timestamp     int64 `json:"timestamp"`
	Latency       int64 `json:"latency"`
	CronTimestamp int64 `json:"cronTimestamp"`

	Error uint8 `json:"error"`
}

func (h *privateLocationHandler) IngestDNS(ctx context.Context, req *connect.Request[private_locationv1.IngestDNSRequest]) (*connect.Response[private_locationv1.IngestDNSResponse], error) {
	token := req.Header().Get("openstatus-token")
	if token == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, ErrMissingToken)
	}

	if err := ValidateIngestDNSRequest(req.Msg); err != nil {
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
			"datasource":   tinybird.DatasourceDNS,
		}
	}

	records := make(map[string][]string)
	for recordType, record := range req.Msg.Records {
		r := []string{}
		r = append(r, record.GetRecord()...)
		records[recordType] = r
	}

	recordsJSON, err := json.Marshal(records)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	data := DNSResponse{
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
		Records:       string(recordsJSON),
	}

	h.sendEventAndUpdateLastSeen(ctx, data, tinybird.DatasourceDNS, ic.Region.ID)

	return connect.NewResponse(&private_locationv1.IngestDNSResponse{}), nil
}
