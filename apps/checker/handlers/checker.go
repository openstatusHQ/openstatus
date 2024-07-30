package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/assertions"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

type statusCode int

func (s statusCode) IsSuccessful() bool {
	return s >= 200 && s < 300
}


func (h Handler) CheckerHandler(c *gin.Context) {
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

	var req request.CheckerRequest
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

	var called int
	op := func() error {
		called++
		res, err := checker.Ping(ctx, requestClient, req)
		if err != nil {
			return fmt.Errorf("unable to ping: %w", err)
		}
		statusCode := statusCode(res.StatusCode)

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
					isSuccessfull = isSuccessfull && target.HeaderEvaluate(res.Headers)

				case request.AssertionTextBody:
					var target assertions.StringTargetType
					if err := json.Unmarshal(a, &target); err != nil {
						return fmt.Errorf("unable to unmarshal IntTarget: %w", err)
					}
					isSuccessfull = isSuccessfull && target.StringEvaluate(res.Body)

				case request.AssertionStatus:
					var target assertions.StatusTarget
					if err := json.Unmarshal(a, &target); err != nil {
						return fmt.Errorf("unable to unmarshal IntTarget: %w", err)
					}
					isSuccessfull = isSuccessfull && target.StatusEvaluate(int64(res.StatusCode))
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
			return fmt.Errorf("unable to ping: %v with status %v", res, res.StatusCode)
		}

		// it's in error if not successful
		if isSuccessfull {
			res.Error = 0
			// Small trick to avoid sending the body at the moment to TB
			res.Body = ""
		} else {
			res.Error = 1
		}

		res.Assertions = assertionAsString
		// That part could be refactored
		if !isSuccessfull && req.Status == "active" {
			// Q: Why here we do not check if the status was previously active?
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "error",
				StatusCode:    res.StatusCode,
				Region:        h.Region,
				Message:       res.Message,
				CronTimestamp: req.CronTimestamp,
			})
		}
		// Check if the status is degraded
		if isSuccessfull && req.Status == "active" {
			if req.DegradedAfter > 0 && res.Latency > req.DegradedAfter {
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:     req.MonitorID,
					Status:        "degraded",
					Region:        h.Region,
					StatusCode:    res.StatusCode,
					CronTimestamp: req.CronTimestamp,
				})
			}
		}
		// We were in error and now we are successful don't check for degraded
		if isSuccessfull && req.Status == "error" {
			// Q: Why here we check the data before updating the status in this scenario?
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "active",
				Region:        h.Region,
				StatusCode:    res.StatusCode,
				CronTimestamp: req.CronTimestamp,
			})
		}
		// if we were in degraded and now we are successful, we should update the status to active
		if isSuccessfull && req.Status == "degraded" {
			if req.DegradedAfter > 0 && res.Latency <= req.DegradedAfter {
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:     req.MonitorID,
					Status:        "active",
					Region:        h.Region,
					StatusCode:    res.StatusCode,
					CronTimestamp: req.CronTimestamp,
				})
			}
		}

		if err := h.TbClient.SendEvent(ctx, res, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		return nil
	}

	if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
		if err := h.TbClient.SendEvent(ctx, checker.PingData{
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
		}, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}

		if req.Status == "active" {
			checker.UpdateStatus(ctx, checker.UpdateData{
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
