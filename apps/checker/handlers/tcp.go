package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

type TCPResponse struct {
	Error       string                    `json:"error,omitempty"`
	Region      string                    `json:"region"`
	RequestId   int64                     `json:"requestId,omitempty"`
	WorkspaceID int64                     `json:"workspaceId"`
	MonitorID   int64                     `json:"monitorId"`
	Timestamp   int64                     `json:"timestamp"`
	Timing      checker.TCPResponseTiming `json:"timing"`
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

	updateStatusClient := checker.NewClient(&http.Client{
		Timeout: 10 * time.Second,
	})

	var called int
	op := func() error {
		called++
		res, err := checker.PingTcp(int(req.Timeout), req.URL)

		if err != nil {
			return fmt.Errorf("unable to check tcp %s", err)
		}

		r := TCPResponse{
			WorkspaceID: workspaceId,
			Timestamp:   req.CronTimestamp,
			Timing: checker.TCPResponseTiming{
				TCPStart: res.TCPStart,
				TCPDone:  res.TCPDone,
			},
			Region:    h.Region,
			MonitorID: monitorId,
		}
		latency := res.TCPDone - res.TCPStart

		if req.Status == "active" && req.DegradedAfter > 0 && latency > req.DegradedAfter {
			updateStatusClient.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "degraded",
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
			})
		}

		if req.Status == "degraded" && req.DegradedAfter > 0 && latency <= req.DegradedAfter {
			updateStatusClient.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "active",
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
			})
		}

		if req.Status == "error" {
			updateStatusClient.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "active",
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
			})
		}

		if err := h.TbClient.SendEvent(ctx, r, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		return nil
	}

	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		if err := h.TbClient.SendEvent(ctx, TCPResponse{
			WorkspaceID: workspaceId,
			Timestamp:   req.CronTimestamp,
			Error:       err.Error(),
			Region:      h.Region,
			MonitorID:   monitorId,
		}, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		if req.Status == "active" {
			updateStatusClient.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "error",
				Message:       err.Error(),
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h Handler) TCPHandlerRegion(c *gin.Context) {
	ctx := c.Request.Context()
	dataSourceName := "check_tcp_response__v1"

	region := c.Param("region")
	if region == "" {
		c.String(http.StatusBadRequest, "region is required")

		return
	}

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

	var called int

	var response TCPResponse

	op := func() error {
		called++
		res, err := checker.PingTcp(int(req.Timeout), req.URL)

		if err != nil {
			return fmt.Errorf("unable to check tcp %s", err)
		}

		response = TCPResponse{
			WorkspaceID: workspaceId,
			Timestamp:   req.CronTimestamp,
			Timing: checker.TCPResponseTiming{
				TCPStart: res.TCPStart,
				TCPDone:  res.TCPDone,
			},
			Region:    h.Region,
			MonitorID: monitorId,
		}

		if req.RequestId != 0 {
			if err := h.TbClient.SendEvent(ctx, response, dataSourceName); err != nil {
				log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
			}
		}

		return nil
	}

	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		if err := h.TbClient.SendEvent(ctx, TCPResponse{
			WorkspaceID: workspaceId,
			Timestamp:   req.CronTimestamp,
			Error:       err.Error(),
			Region:      h.Region,
			MonitorID:   monitorId,
		}, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}
	}

	c.JSON(http.StatusOK, response)
}
