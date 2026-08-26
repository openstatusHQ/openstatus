package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openstatushq/openstatus/apps/checker/checker"
	otelOS "github.com/openstatushq/openstatus/apps/checker/pkg/otel"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

// Only used for Tinybird.
type GRPCData struct {
	ID            string `json:"id"`
	Timing        string `json:"timing"`
	ErrorMessage  string `json:"errorMessage"`
	Region        string `json:"region"`
	Trigger       string `json:"trigger"`
	URI           string `json:"uri"`
	Service       string `json:"service,omitempty"`
	ServingStatus string `json:"servingStatus,omitempty"`
	RequestStatus string `json:"requestStatus,omitempty"`

	RequestId     int64 `json:"requestId,omitempty"`
	WorkspaceID   int64 `json:"workspaceId"`
	MonitorID     int64 `json:"monitorId"`
	Timestamp     int64 `json:"timestamp"`
	Latency       int64 `json:"latency"`
	CronTimestamp int64 `json:"cronTimestamp"`
	GRPCCode      int64 `json:"grpcCode"`

	Error uint8 `json:"error"`
}

func grpcCheck(req request.GRPCCheckerRequest) (checker.GRPCResult, error) {
	return checker.CheckGRPC(
		req.Timeout,
		req.URI,
		req.Service,
		checker.ParseGRPCTLSMode(req.TLS),
		req.Headers,
	)
}

func (h Handler) GRPCHandler(c *gin.Context) {
	ctx := c.Request.Context()
	dataSourceName := "grpc_response__v0"

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

	var req request.GRPCCheckerRequest
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

	e, f := c.Get("event")
	if f {
		t := e.(map[string]any)
		t["checker"] = map[string]string{
			"uri":          req.URI,
			"workspace_id": req.WorkspaceID,
			"monitor_id":   req.MonitorID,
			"trigger":      trigger,
			"type":         "grpc",
		}
		c.Set("event", t)
	}

	var response checker.GRPCResponse

	var retry int
	if req.Retry != 0 {
		retry = int(req.Retry)
	} else {
		retry = 3
	}

	op := func() error {
		res, err := grpcCheck(req)
		if err != nil {
			// Only a call that never reached the server is worth repeating. A
			// server answering NOT_SERVING will answer the same three more times.
			return fmt.Errorf("unable to check grpc %s", err)
		}

		timingAsString, err := json.Marshal(res.Timing)
		if err != nil {
			return fmt.Errorf("error while parsing timing data %s: %w", req.URI, err)
		}

		id, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("error while generating uuid %w", err)
		}

		timestamp := time.Now().UTC().UnixMilli()
		degraded := res.Healthy && req.DegradedAfter > 0 && res.Latency > req.DegradedAfter

		requestStatus := "success"
		switch {
		case !res.Healthy:
			requestStatus = "error"
		case degraded:
			requestStatus = "degraded"
		}

		errorFlag := uint8(0)
		errorMessage := ""
		if !res.Healthy {
			errorFlag = 1
			errorMessage = res.Message
		}

		data := GRPCData{
			ID:            id.String(),
			WorkspaceID:   workspaceId,
			Timestamp:     timestamp,
			Error:         errorFlag,
			ErrorMessage:  errorMessage,
			Region:        h.Region,
			MonitorID:     monitorId,
			Timing:        string(timingAsString),
			Latency:       res.Latency,
			GRPCCode:      res.GRPCCode,
			ServingStatus: res.ServingStatus,
			Service:       req.Service,
			CronTimestamp: req.CronTimestamp,
			Trigger:       trigger,
			URI:           req.URI,
			RequestStatus: requestStatus,
		}

		response = checker.GRPCResponse{
			Timestamp:     timestamp,
			Timing:        res.Timing,
			Latency:       res.Latency,
			GRPCCode:      res.GRPCCode,
			ServingStatus: res.ServingStatus,
			Service:       req.Service,
			ErrorMessage:  errorMessage,
			Completed:     res.Completed,
			Error:         errorFlag,
			Region:        h.Region,
			JobType:       "grpc",
		}

		switch {
		case !res.Healthy && req.Status != "error":
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "error",
				Message:       res.Message,
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
				Latency:       res.Latency,
			})
		case degraded && req.Status != "degraded":
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "degraded",
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
				Latency:       res.Latency,
			})
		case res.Healthy && !degraded && req.Status != "active":
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "active",
				Region:        h.Region,
				CronTimestamp: req.CronTimestamp,
				Latency:       res.Latency,
			})
		}

		if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		return nil
	}

	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), uint64(retry))); err != nil {
		id, e := uuid.NewV7()
		if e != nil {
			log.Ctx(ctx).Error().Err(e).Msg("failed to send event to tinybird")
			return
		}
		data := GRPCData{
			ID:            id.String(),
			WorkspaceID:   workspaceId,
			CronTimestamp: req.CronTimestamp,
			Timestamp:     time.Now().UTC().UnixMilli(),
			ErrorMessage:  err.Error(),
			Region:        h.Region,
			MonitorID:     monitorId,
			Error:         1,
			Trigger:       trigger,
			URI:           req.URI,
			Service:       req.Service,
			RequestStatus: "error",
		}
		if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     req.MonitorID,
			Status:        "error",
			Message:       err.Error(),
			Region:        h.Region,
			CronTimestamp: req.CronTimestamp,
		})

		// Only the success path inside op() fills these in, so a check that
		// exhausted its retries would otherwise be returned under `?data=true`
		// with an empty jobType and region — a shape no caller can parse.
		response.JobType = "grpc"
		response.Region = h.Region
		response.ErrorMessage = err.Error()
		response.Error = 1
	}

	if req.OtelConfig.Endpoint != "" {
		otelOS.RecordGRPCMetrics(ctx, req, response, h.Region)
	}

	returnData := c.Query("data")
	if returnData == "true" {
		c.JSON(http.StatusOK, response)

		return
	}

	c.JSON(http.StatusOK, nil)
}

func (h Handler) GRPCHandlerRegion(c *gin.Context) {
	ctx := c.Request.Context()
	dataSourceName := "check_grpc_response__v0"

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

	var req request.GRPCCheckerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})

		return
	}

	var response checker.GRPCResponse

	op := func() error {
		timestamp := time.Now().UTC().UnixMilli()
		res, err := grpcCheck(req)
		if err != nil {
			return fmt.Errorf("unable to check grpc %s", err)
		}

		errorFlag := uint8(0)
		errorMessage := ""
		if !res.Healthy {
			errorFlag = 1
			errorMessage = res.Message
		}

		response = checker.GRPCResponse{
			Timestamp:     timestamp,
			Timing:        res.Timing,
			Latency:       res.Latency,
			GRPCCode:      res.GRPCCode,
			ServingStatus: res.ServingStatus,
			Service:       req.Service,
			ErrorMessage:  errorMessage,
			Completed:     res.Completed,
			Error:         errorFlag,
			Region:        h.Region,
			JobType:       "grpc",
		}

		timingAsString, err := json.Marshal(res.Timing)
		if err != nil {
			return fmt.Errorf("error while parsing timing data %s: %w", req.URI, err)
		}

		data := GRPCData{
			CronTimestamp: req.CronTimestamp,
			Timestamp:     timestamp,
			Error:         errorFlag,
			ErrorMessage:  errorMessage,
			Region:        h.Region,
			Timing:        string(timingAsString),
			Latency:       res.Latency,
			GRPCCode:      res.GRPCCode,
			ServingStatus: res.ServingStatus,
			Service:       req.Service,
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

	err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3))
	if err != nil {
		response.JobType = "grpc"
		response.Region = h.Region
		response.ErrorMessage = err.Error()
		response.Error = 1
	}

	if req.OtelConfig.Endpoint != "" {
		otelOS.RecordGRPCMetrics(ctx, req, response, region)
	}

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "uri not reachable"})

		return
	}

	c.JSON(http.StatusOK, response)
}
