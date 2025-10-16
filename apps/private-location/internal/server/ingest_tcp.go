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
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing token"))
	}

	dataSourceName := "tcp_response__v0"


	var monitors database.Monitor
	err := h.db.Get(&monitors, "SELECT monitor.* FROM monitor JOIN private_location_to_monitor a ON monitor.id = a.monitor_id JOIN private_location b ON a.private_location_id = b.id WHERE b.token = ? AND monitor.deleted_at IS NULL and monitor.id = ?", token, req.Msg.Id)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var region database.PrivateLocation
	err = h.db.Get(&region, "SELECT private_location.id FROM private_location join private_location_to_monitor a ON private_location.id = a.private_location_id WHERE a.monitor_id = ?  and private_location.key = ?", monitors.ID, token)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	data :=		TCPData{
		ID:            req.Msg.Id,
		WorkspaceID:   int64(monitors.WorkspaceID),
		Timestamp:     req.Msg.Timestamp,
		Error:         uint8(req.Msg.Error),
		// ErrorMessage:  req.Msg.ErrorMessage,
		Region:        strconv.Itoa(region.ID),
		MonitorID:     int64(monitors.ID),
		Timing:        req.Msg.Timing,
		Latency:       req.Msg.Latency,
		CronTimestamp: req.Msg.CronTimestamp,
		Trigger:       "cron",
		URI:           req.Msg.Uri,
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
	return nil, nil
}
