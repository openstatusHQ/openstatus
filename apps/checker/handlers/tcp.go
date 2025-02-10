package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	otelOS "github.com/openstatushq/openstatus/apps/checker/pkg/otel"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

// Only used for Tinybird.
type TCPData struct {
	Timing       string `json:"timing"`
	ErrorMessage string `json:"errorMessage"`
	Region       string `json:"region"`
	Trigger      string `json:"trigger"`
	URI          string `json:"uri"`

	RequestId     int64 `json:"requestId,omitempty"`
	WorkspaceID   int64 `json:"workspaceId"`
	MonitorID     int64 `json:"monitorId"`
	Timestamp     int64 `json:"timestamp"`
	Latency       int64 `json:"latency"`
	CronTimestamp int64 `json:"cronTimestamp"`

	Error uint8 `json:"error"`
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

	var trigger = "cron"
	if req.Trigger != "" {
		trigger = req.Trigger
	}

	var called int

	var response checker.TCPResponse

	op := func() error {
		called++
		res, err := checker.PingTcp(int(req.Timeout), req.URI)

		if err != nil {
			return fmt.Errorf("unable to check tcp %s", err)
		}

		timingAsString, err := json.Marshal(res)
		if err != nil {
			return fmt.Errorf("error while parsing timing data %s: %w", req.URI, err)
		}

		latency := res.TCPDone - res.TCPStart

		data := TCPData{
			WorkspaceID:   workspaceId,
			Timestamp:     res.TCPStart,
			Error:         0,
			ErrorMessage:  "",
			Region:        h.Region,
			MonitorID:     monitorId,
			Timing:        string(timingAsString),
			Latency:       latency,
			CronTimestamp: req.CronTimestamp,
			Trigger:       trigger,
			URI:           req.URI,
		}

		response = checker.TCPResponse{
			Timestamp: res.TCPStart,
			Timing: checker.TCPResponseTiming{
				TCPStart: res.TCPStart,
				TCPDone:  res.TCPDone,
			},
			Latency: latency,
			Region:  h.Region,
			JobType: "tcp",
		}

		if req.Status == "active" && req.DegradedAfter > 0 && latency > req.DegradedAfter {
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "degraded",
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
			})
		}

		if req.Status == "degraded" && req.DegradedAfter > 0 && latency <= req.DegradedAfter {
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "active",
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
			})
		}

		if req.Status == "error" {
			if req.DegradedAfter == 0 || (req.DegradedAfter > 0 && latency < req.DegradedAfter) {
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:     req.MonitorID,
					Status:        "active",
					Region:        h.Region,
					CronTimestamp: req.CronTimestamp,
				})
			}

			if req.DegradedAfter > 0 && latency > req.DegradedAfter {
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:     req.MonitorID,
					Status:        "degraded",
					Region:        h.Region,
					CronTimestamp: req.CronTimestamp,
				})
			}

		}

		if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		return nil
	}

	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		if err := h.TbClient.SendEvent(ctx, TCPData{
			WorkspaceID:   workspaceId,
			CronTimestamp: req.CronTimestamp,
			ErrorMessage:  err.Error(),
			Region:        h.Region,
			MonitorID:     monitorId,
			Error:         1,
			Trigger:       trigger,
			URI:           req.URI,
		}, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		if req.Status != "error" {
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "error",
				Message:       err.Error(),
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
			})
		}
	}

	returnData := c.Query("data")
	if returnData == "true" {
		c.JSON(http.StatusOK, response)

		return
	}

	c.JSON(http.StatusOK, nil)
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

	var called int

	var response checker.TCPResponse

	op := func() error {
		called++
		timestamp := time.Now().UTC().UnixMilli()
		res, err := checker.PingTcp(int(req.Timeout), req.URI)

		if err != nil {
			return fmt.Errorf("unable to check tcp %s", err)
		}

		response = checker.TCPResponse{
			Timestamp: timestamp,
			Timing: checker.TCPResponseTiming{
				TCPStart: res.TCPStart,
				TCPDone:  res.TCPDone,
			},
			Latency: res.TCPDone - res.TCPStart,
			Region:  h.Region,
			JobType: "tcp",
		}

		timingAsString, err := json.Marshal(res)
		if err != nil {
			return fmt.Errorf("error while parsing timing data %s: %w", req.URI, err)
		}

		latency := res.TCPDone - res.TCPStart

		data := TCPData{
			CronTimestamp: req.CronTimestamp,
			Timestamp:     res.TCPStart,
			Error:         0,
			ErrorMessage:  "",
			Region:        h.Region,
			Timing:        string(timingAsString),
			Latency:       latency,
			RequestId:     req.RequestId,
			Trigger:       "api",
			URI:           req.URI,
		}

		if req.RequestId != 0 {
			if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
				log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
			}
		}

		return nil
	}

	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})

		return
	}

	if req.OtelConfig.Endpoint != "" {

		otelOS.RecordTCPMetrics(ctx, req, response, region)

	}

	c.JSON(http.StatusOK, response)
}
