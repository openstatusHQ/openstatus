package server

import (
	"context"
	"errors"
	"strconv"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
	"github.com/rs/zerolog/log"
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
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing token"))
	}

	dataSourceName := "ping_response__v8"

	var monitors database.Monitor

	err := h.db.Get(&monitors, "SELECT monitor.* FROM monitor JOIN private_location_to_monitor a ON monitor.id = a.monitor_id JOIN private_location b ON a.private_location_id = b.id WHERE b.key = $1 AND monitor.deleted_at IS NULL and monitor.id = $2", token, req.Msg.MonitorId)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var region database.PrivateLocation
	err = h.db.Get(&region, "SELECT private_location.id FROM private_location join private_location_to_monitor a ON private_location.id = a.private_location_id WHERE a.monitor_id = $1  and private_location.key = $2", monitors.ID, token)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	data := PingData{
		ID:            req.Msg.Id,
		Latency:       req.Msg.Latency,
		StatusCode:    int(req.Msg.StatusCode),
		MonitorID:     req.Msg.Id,
		Region:        strconv.Itoa(region.ID),
		WorkspaceID:   strconv.Itoa(monitors.WorkspaceID),
		Timestamp:     req.Msg.Timestamp,
		CronTimestamp: req.Msg.CronTimestamp,
		URL:           monitors.URL,
		Method:        monitors.Method,
		Timing:        req.Msg.Timing,
		Headers:       req.Msg.Headers,
		Body:          req.Msg.Body,
		Trigger:       "cron",
		RequestStatus: req.Msg.RequestStatus,
	}
	if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
	}
	_,err = h.db.NamedExec("UPDATE private_location SET last_seen_at = :last_seen_at WHERE id = :id", map[string]any{
		"last_seen_at": time.Now().Unix(),
		"id":           region.ID,
	})
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to update private location")
	}

	return connect.NewResponse(&private_locationv1.IngestHTTPResponse{}), nil
}
