package handlers

import (
	"fmt"
	"net/http"

	"github.com/cenkalti/backoff/v4"
	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

type TCPResponse struct {
	WorkspaceID string                    `json:"workspaceId"`
	MonitorID   string                    `json:"monitorId"`
	Timestamp   int64                     `json:"timestamp"`
	Timing      checker.TCPResponseTiming `json:"timing"`
	Error       string                    `json:"error,omitempty"`
	Region      string                    `json:"region"`
}

func (h Handler) TCPHandler(c *gin.Context) {
	ctx := c.Request.Context()
	dataSourceName := "tcp_response__v0"
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
	var req request.TCPCheckerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var called int
	op := func() error {
		called++
		res, err := checker.PingTcp(int(req.Timeout), req.URL)
		if err != nil {
			return fmt.Errorf("unable to check tcp", err)
		}

		r := TCPResponse{
			WorkspaceID: req.WorkspaceID,
			Timestamp:   req.CronTimestamp,
			Timing: checker.TCPResponseTiming{
				TCPStart: res.TCPStart,
				TCPDone:  res.TCPDone,
			},
			Region:    h.Region,
			MonitorID: req.MonitorID,
		}

		if err := h.TbClient.SendEvent(ctx, r, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		return nil
	}

	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		if err := h.TbClient.SendEvent(ctx, TCPResponse{
			WorkspaceID: req.WorkspaceID,
			Timestamp:   req.CronTimestamp,
			Error:       err.Error(),
			Region:      h.Region,
			MonitorID:   req.MonitorID,
		}, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})

}
