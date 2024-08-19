package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

type PingResponse struct {
	Body        string         `json:"body,omitempty"`
	Headers     string         `json:"headers,omitempty"`
	Region      string         `json:"region"`
	RequestId   int64          `json:"requestId,omitempty"`
	WorkspaceId int64          `json:"workspaceId,omitempty"`
	Latency     int64          `json:"latency"`
	Time        int64          `json:"time"`
	Status      int            `json:"status,omitempty"`
	Timing      checker.Timing `json:"timing"`
}

func (h Handler) PingRegionHandler(c *gin.Context) {
	ctx := c.Request.Context()

	dataSourceName := "check_response__v1"
	region := c.Param("region")
	if region == "" {
		c.String(http.StatusBadRequest, "region is required")
		return
	}
	fmt.Printf("Start of /ping/%s\n", region)

	if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", h.Secret) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if h.CloudProvider == "fly" {
		if region != h.Region {
			c.Header("fly-replay", fmt.Sprintf("region=%s", region))
			c.String(http.StatusAccepted, "Forwarding request to %s", region)
			return
		}
	}

	//  We need a new client for each request to avoid connection reuse.
	requestClient := &http.Client{
		Timeout: 45 * time.Second,
	}
	defer requestClient.CloseIdleConnections()

	var req request.PingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	var res checker.Response
	op := func() error {
		r, err := checker.SinglePing(c.Request.Context(), requestClient, req)
		if err != nil {
			return fmt.Errorf("unable to ping: %w", err)
		}

		r.Region = h.Region

		headersAsString, err := json.Marshal(r.Headers)
		if err != nil {
			return nil
		}

		tbData := PingResponse{
			RequestId:   req.RequestId,
			WorkspaceId: req.WorkspaceId,
			Status:      r.Status,
			Latency:     r.Latency,
			Body:        r.Body,
			Headers:     string(headersAsString),
			Time:        r.Time,
			Timing:      r.Timing,
			Region:      r.Region,
		}

		res = r
		if tbData.RequestId != 0 {
			if err := h.TbClient.SendEvent(ctx, tbData, dataSourceName); err != nil {
				log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
			}
		}
		return nil
	}
	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	return
	c.JSON(http.StatusOK, res)
}
