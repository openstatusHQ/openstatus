package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/assertions"
	otelOS "github.com/openstatushq/openstatus/apps/checker/pkg/otel"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

type statusCode int

func (s statusCode) IsSuccessful() bool {
	return s >= 200 && s < 300
}

type PingData struct {
	ID            string `json:"id"`
	WorkspaceID   string `json:"workspaceId"`
	MonitorID     string `json:"monitorId"`
	URL           string `json:"url"`
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

func (h Handler) HTTPCheckerHandler(c *gin.Context) {
	ctx := c.Request.Context()
	dataSourceName := "ping_response__v8"

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

	var req request.HttpCheckerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})

		return
	}
	//  We need a new client for each request to avoid connection reuse.
	requestClient := &http.Client{
		Timeout: time.Duration(req.Timeout) * time.Millisecond,
	}
	defer requestClient.CloseIdleConnections()

	// Might be a more efficient way to do it
	var i interface{} = req.RawAssertions
	jsonBytes, _ := json.Marshal(i)
	assertionAsString := string(jsonBytes)

	if assertionAsString == "null" {
		assertionAsString = ""
	}

	trigger := "cron"
	if req.Trigger != "" {
		trigger = req.Trigger
	}

	var called int

	var result checker.Response

	op := func() error {
		called++
		res, err := checker.Http(ctx, requestClient, req)

		if err != nil {
			return fmt.Errorf("unable to ping: %w", err)
		}

		// In TB we need to store them as string
		timingAsString, err := json.Marshal(res.Timing)
		if err != nil {
			return fmt.Errorf("error while parsing timing data %s: %w", req.URL, err)
		}

		headersAsString, err := json.Marshal(res.Headers)
		if err != nil {
			return fmt.Errorf("error while parsing headers %s: %w", req.URL, err)
		}

		id, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("error while generating uuid %w", err)
		}

		var requestStatus = ""
		switch req.Status {
		case "active":
			requestStatus = "success"
			break
		case "error":
			requestStatus = "error"
			break
		case "degraded":
			requestStatus = "degraded"
			break
		}

		data := PingData{
			ID:            id.String(),
			Latency:       res.Latency,
			StatusCode:    res.Status,
			MonitorID:     req.MonitorID,
			Region:        h.Region,
			WorkspaceID:   req.WorkspaceID,
			Timestamp:     res.Timestamp,
			CronTimestamp: req.CronTimestamp,
			URL:           req.URL,
			Timing:        string(timingAsString),
			Headers:       string(headersAsString),
			Body:          string(res.Body),
			Trigger:       trigger,
			RequestStatus: requestStatus,
		}

		statusCode := statusCode(res.Status)

		var isSuccessfull bool = true

		if len(req.RawAssertions) > 0 {
			for _, a := range req.RawAssertions {
				var assert request.Assertion
				err = json.Unmarshal(a, &assert)
				if err != nil {
					// handle error
					return fmt.Errorf("unable to unmarshal assertion: %w", err)
				}

				switch assert.AssertionType {
				case request.AssertionHeader:
					var target assertions.HeaderTarget
					if err := json.Unmarshal(a, &target); err != nil {
						return fmt.Errorf("unable to unmarshal IntTarget: %w", err)
					}

					isSuccessfull = isSuccessfull && target.HeaderEvaluate(data.Headers)
				case request.AssertionTextBody:
					var target assertions.StringTargetType
					if err := json.Unmarshal(a, &target); err != nil {
						return fmt.Errorf("unable to unmarshal IntTarget: %w", err)
					}

					isSuccessfull = isSuccessfull && target.StringEvaluate(data.Body)
				case request.AssertionStatus:
					var target assertions.StatusTarget
					if err := json.Unmarshal(a, &target); err != nil {
						return fmt.Errorf("unable to unmarshal IntTarget: %w", err)
					}

					isSuccessfull = isSuccessfull && target.StatusEvaluate(int64(res.Status))
				case request.AssertionJsonBody:
					fmt.Println("assertion type", assert.AssertionType)
				default:
					fmt.Println("! Not Handled assertion type", assert.AssertionType)
				}
			}
		} else {
			isSuccessfull = statusCode.IsSuccessful()
		}

		// let's retry at least once if the status code is not successful.
		if !isSuccessfull && called < 2 {
			return fmt.Errorf("unable to ping: %v with status %v", res, res.Status)
		}

		result = res
		result.Region = h.Region
		result.JobType = "http"

		// it's in error if not successful
		if isSuccessfull {
			data.Error = 0
			if req.DegradedAfter != 0 && res.Latency > req.DegradedAfter {
				data.Body = res.Body

			} else {
				data.Body = ""

			}
			// Small trick to avoid sending the body at the moment to TB
		} else {
			data.Error = 1
			result.Error = "Error"
		}

		data.Assertions = assertionAsString

		if !isSuccessfull && req.Status != "error" {
			// Q: Why here we do not check if the status was previously active?
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "error",
				StatusCode:    res.Status,
				Region:        h.Region,
				Message:       res.Error,
				CronTimestamp: req.CronTimestamp,
				Latency:       res.Latency,
			})
			data.RequestStatus = "error"
		}
		// it's degraded
		if isSuccessfull && req.DegradedAfter > 0 && res.Latency > req.DegradedAfter && req.Status != "degraded" {
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "degraded",
				Region:        h.Region,
				StatusCode:    res.Status,
				CronTimestamp: req.CronTimestamp,
				Latency:       res.Latency,
			})
			data.RequestStatus = "degraded"
		}
		// it's active
		if isSuccessfull && req.DegradedAfter == 0 && req.Status != "active" {
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "active",
				Region:        h.Region,
				StatusCode:    res.Status,
				CronTimestamp: req.CronTimestamp,
				Latency:       res.Latency,
			})
			data.RequestStatus = "success"
		}
		// it's active
		if isSuccessfull && res.Latency < req.DegradedAfter && req.DegradedAfter != 0 && req.Status != "active" {
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "active",
				Region:        h.Region,
				StatusCode:    res.Status,
				CronTimestamp: req.CronTimestamp,
			})
			data.RequestStatus = "success"
		}

		if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		return nil
	}

	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		id, e := uuid.NewV7()
		if e != nil {
			log.Ctx(ctx).Error().Err(e).Msg("failed to send event to tinybird")
			return
		}

		data := PingData{
			ID:            id.String(),
			URL:           req.URL,
			Region:        h.Region,
			Message:       err.Error(),
			CronTimestamp: req.CronTimestamp,
			Timestamp:     req.CronTimestamp,
			MonitorID:     req.MonitorID,
			WorkspaceID:   req.WorkspaceID,
			Error:         1,
			Assertions:    assertionAsString,
			Body:          "",
			Trigger:       trigger,
			RequestStatus: "error",
		}

		if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
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

	if req.OtelConfig.Endpoint != "" {
		otelOS.RecordHTTPMetrics(ctx, req, result, h.Region)
	}

	returnData := c.Query("data")
	if returnData == "true" {

		if len(result.Body) > 1024 {
			result.Body = result.Body[:1000]
		}

		c.JSON(http.StatusOK, result)

		return
	}

	c.JSON(http.StatusOK, nil)
}
