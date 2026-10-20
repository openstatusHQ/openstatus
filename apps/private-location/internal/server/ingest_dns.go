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

	Attempt  int `json:"attempt,omitempty"`
	Attempts int `json:"attempts,omitempty"`
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

	recordsJSON, err := recordsToJSON(req.Msg.Records)
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
		Records:       recordsJSON,
		ErrorMessage:  req.Msg.Message,
		Attempts:      len(req.Msg.Attempts) + 1,
	}

	h.sendEventAndUpdateLastSeen(ctx, data, tinybird.DatasourceDNS, ic.Region.ID)

	attempts := make([]DNSResponse, 0, len(req.Msg.Attempts))
	for i, a := range req.Msg.Attempts {
		attemptRecords, err := recordsToJSON(a.Records)
		if err != nil {
			continue
		}
		attempt := data
		attempt.ID = a.Id
		attempt.Latency = a.Latency
		attempt.Timestamp = a.Timestamp
		attempt.RequestStatus = a.RequestStatus
		attempt.ErrorMessage = a.Message
		attempt.Records = attemptRecords
		attempt.Timing = a.Timing
		attempt.Error = uint8(a.Error)
		attempt.Attempt = i + 1
		attempt.Attempts = 0
		attempts = append(attempts, attempt)
	}
	sendAttempts(ctx, h.TbClient, attempts, tinybird.DatasourceDNSAttempt)

	h.forwardStatusUpdate(ctx, ic, statusUpdateInput{
		RequestStatus: data.RequestStatus,
		Message:       data.ErrorMessage,
		Latency:       data.Latency,
		CronTimestamp: data.CronTimestamp,
		ErrorFlag:     data.Error,
	})

	return connect.NewResponse(&private_locationv1.IngestDNSResponse{}), nil
}

func recordsToJSON(protoRecords map[string]*private_locationv1.Records) (string, error) {
	records := make(map[string][]string, len(protoRecords))
	for recordType, record := range protoRecords {
		r := []string{}
		r = append(r, record.GetRecord()...)
		records[recordType] = r
	}

	recordsJSON, err := json.Marshal(records)
	if err != nil {
		return "", err
	}

	return string(recordsJSON), nil
}
