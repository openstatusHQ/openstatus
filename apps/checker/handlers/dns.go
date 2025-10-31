package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"

	"github.com/cenkalti/backoff/v5"
)

type DNSData struct {
	ID            string `json:"id"`
	Timing        string `json:"timing"`
	ErrorMessage  string `json:"errorMessage"`
	Region        string `json:"region"`
	Trigger       string `json:"trigger"`
	URI           string `json:"uri"`
	RequestStatus string `json:"requestStatus,omitempty"`
	Records 	string `json:"records"`

	RequestId     int64 `json:"requestId,omitempty"`
	WorkspaceID   int64 `json:"workspaceId"`
	MonitorID     int64 `json:"monitorId"`
	Timestamp     int64 `json:"timestamp"`
	Latency       int64 `json:"latency"`
	CronTimestamp int64 `json:"cronTimestamp"`

	Error uint8 `json:"error"`
}

func (h Handler) DNSHandler(c *gin.Context) {
	ctx := c.Request.Context()

	dataSourceName := "dns_response__v0"

	if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", h.Secret) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})

		return
	}

	if h.CloudProvider == "fly" {
		// if the request has been routed to a wrong region, we forward it to the correct one.
		region := c.GetHeader("fly-prefer-region")
		if region != "" && region != h.Region {
			c.Header("fly-replay", fmt.Sprintf("region=%s", region))
			c.String(http.StatusAccepted, "Forwarding request to %s", region)

			return
		}
	}

	var req request.DNSCheckerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})

		return
	}

	workspaceId, err := strconv.ParseInt(req.WorkspaceID, 10, 64)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})

		return
	}

	monitorId, err := strconv.ParseInt(req.MonitorID, 10, 64)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})

		return
	}

	var trigger = "cron"
	if req.Trigger != "" {
		trigger = req.Trigger
	}

	// var response checker.TCPResponse

	var retry int
	if req.Retry == 0 {
		retry = int(req.Retry)
	} else {
		retry = 3
	}

	op := func() (*checker.DnsResponse, error){
		response, err := checker.Dns(ctx, req.URI)

		return response, err
	}

	result, err := backoff.Retry(ctx, op, backoff.WithBackOff(backoff.NewExponentialBackOff()), backoff.WithMaxTries(uint(retry)))

	id, e := uuid.NewV7()
	if e != nil {
		log.Ctx(ctx).Error().Err(e).Msg("failed to send event to tinybird")
		return
	}

	data := DNSData{

		ID:          id.String(),
		Region:      h.Region,
		Trigger:     trigger,
		URI:         req.URI,
		WorkspaceID: workspaceId,
		MonitorID:   monitorId,
	}
	if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
	}

	fmt.Println("DNS check result:", result)
}
