package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/assertions"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"

	"github.com/cenkalti/backoff/v5"
)

type DNSResponse struct {
	ID            string `json:"id"`
	ErrorMessage  string `json:"errorMessage"`
	Region        string `json:"region"`
	Trigger       string `json:"trigger"`
	URI           string `json:"uri"`
	RequestStatus string `json:"requestStatus,omitempty"`
	Assertions    string `json:"assertions"`

	Records map[string][]string `json:"records"`

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
	const defaultRetry = 3
	dataSourceName := "dns_response__v0"

	// Parse request
	var req request.DNSCheckerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	workspaceId, err := strconv.ParseInt(req.WorkspaceID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace id"})
		return
	}

	monitorId, err := strconv.ParseInt(req.MonitorID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid monitor id"})
		return
	}

	trigger := req.Trigger
	if trigger == "" {
		trigger = "cron"
	}

	retry := defaultRetry
	if req.Retry != 0 {
		retry = int(req.Retry)
	}

	id, e := uuid.NewV7()
	if e != nil {
		log.Ctx(ctx).Error().Err(e).Msg("failed to generate UUID")
		return
	}

	requestStatus := mapMonitorStatus(req.Status)

	data := DNSResponse{
		ID:            id.String(),
		Region:        h.Region,
		Trigger:       trigger,
		URI:           req.URI,
		WorkspaceID:   workspaceId,
		MonitorID:     monitorId,
		CronTimestamp: req.CronTimestamp,
		RequestStatus: requestStatus,
		Timestamp:     time.Now().UTC().UnixMilli(),
	}

	var (
		latency      int64
		isSuccessful = true
		called       int
	)

	op := func() (*checker.DnsResponse, error) {
		called++
		log.Ctx(ctx).Debug().Msgf("performing dns check for %s (attempt %d/%d)", req.URI, called, retry)
		start := time.Now().UTC().UnixMilli()
		response, err := checker.Dns(ctx, req.URI)
		latency = time.Now().UTC().UnixMilli() - start

		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("dns check failed")
			return nil, err
		}
		if len(req.RawAssertions) > 0 {
			log.Ctx(ctx).Debug().Msgf("evaluating %d dns assertions", len(req.RawAssertions))
			isSuccessful, err = EvaluateDNSAssertions(req.RawAssertions, response)
			if err != nil {
				return response, backoff.Permanent(err)
			}
		}
		if !isSuccessful && called < retry {
			return nil, backoff.RetryAfter(1)
		}
		if !isSuccessful {
			log.Ctx(ctx).Debug().Msg("dns assertions failed")
			return response, backoff.Permanent(fmt.Errorf("assertion failed"))
		}
		return response, nil
	}

	result, err := backoff.Retry(ctx, op, backoff.WithBackOff(backoff.NewExponentialBackOff()), backoff.WithMaxTries(uint(retry)))
	data.Latency = latency
	if result != nil {
		data.Records = FormatDNSResult(result)
	}

	if len(req.RawAssertions) > 0 {
		if j, err := json.Marshal(req.RawAssertions); err == nil {
			data.Assertions = string(j)
		} else {
			log.Ctx(ctx).Error().Err(err).Msg("failed to marshal assertions")
		}
	}

	// Status update logic
	switch {
	case !isSuccessful:
		log.Ctx(ctx).Debug().Msg("DNS check failed assertions")
		data.RequestStatus = "error"
		data.Error = 1
		data.ErrorMessage = err.Error()
		if req.Status != "error" {
			checker.UpdateStatus(ctx, checker.UpdateData{
				MonitorId:     req.MonitorID,
				Status:        "error",
				Region:        h.Region,
				Message:       err.Error(),
				CronTimestamp: req.CronTimestamp,
				Latency:       latency,
			})
		}
	case isSuccessful && req.DegradedAfter > 0 && latency > req.DegradedAfter && req.Status != "degraded":
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     req.MonitorID,
			Status:        "degraded",
			Region:        h.Region,
			CronTimestamp: req.CronTimestamp,
			Latency:       latency,
		})
		data.RequestStatus = "degraded"
	case isSuccessful && ((req.DegradedAfter == 0 && req.Status != "active") || (latency < req.DegradedAfter && req.DegradedAfter != 0 && req.Status != "active")):
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     req.MonitorID,
			Status:        "active",
			Region:        h.Region,
			CronTimestamp: req.CronTimestamp,
			Latency:       latency,
		})
		data.RequestStatus = "success"
	}

	if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
	}

	event, f := c.Get("event")
	if f {
		t := event.(map[string]any)
		t["checker"] = map[string]string{
			"uri":          req.URI,
			"workspace_id": req.WorkspaceID,
			"monitor_id":   req.MonitorID,
			"trigger":      trigger,
			"type":         "dns",
		}
		c.Set("event", t)
	}

	c.JSON(http.StatusOK, data)
}

func (h Handler) DNSHandlerRegion(c *gin.Context) {
	ctx := c.Request.Context()
	dataSourceName := "check_dns_response__v0"
	const defaultRetry = 3

	// Parse request
	var req request.DNSCheckerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	retry := defaultRetry
	if req.Retry != 0 {
		retry = int(req.Retry)
	}

	id, e := uuid.NewV7()
	if e != nil {
		log.Ctx(ctx).Error().Err(e).Msg("failed to generate UUID")
		return
	}

	workspaceId, err := strconv.ParseInt(req.WorkspaceID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace id"})
		return
	}

	requestStatus := mapMonitorStatus(req.Status)

	data := DNSResponse{
		ID:            id.String(),
		Region:        h.Region,
		URI:           req.URI,
		WorkspaceID:   workspaceId,
		CronTimestamp: req.CronTimestamp,
		RequestStatus: requestStatus,
		Timestamp:     time.Now().UTC().UnixMilli(),
	}

	var (
		latency      int64
		isSuccessful = true
		called       int
	)

	op := func() (*checker.DnsResponse, error) {
		called++
		log.Ctx(ctx).Debug().Msgf("performing dns check for %s (attempt %d/%d)", req.URI, called, retry)
		start := time.Now().UTC().UnixMilli()
		response, err := checker.Dns(ctx, req.URI)
		latency = time.Now().UTC().UnixMilli() - start

		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("dns check failed")
			return nil, err
		}
		if len(req.RawAssertions) > 0 {
			log.Ctx(ctx).Debug().Msgf("evaluating %d dns assertions", len(req.RawAssertions))
			isSuccessful, err = EvaluateDNSAssertions(req.RawAssertions, response)
			if err != nil {
				return nil, backoff.Permanent(err)
			}
		}
		if !isSuccessful && called < retry {
			return nil, backoff.RetryAfter(1)
		}
		if !isSuccessful {
			log.Ctx(ctx).Debug().Msg("dns assertions failed")
			return response, backoff.Permanent(fmt.Errorf("assertion failed"))
		}
		return response, nil
	}

	result, err := backoff.Retry(ctx, op, backoff.WithBackOff(backoff.NewExponentialBackOff()), backoff.WithMaxTries(uint(retry)))
	data.Latency = latency

	if len(req.RawAssertions) > 0 {
		if j, err := json.Marshal(req.RawAssertions); err == nil {
			data.Assertions = string(j)
		} else {
			log.Ctx(ctx).Error().Err(err).Msg("failed to marshal assertions")
		}
	}

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "uri not reachable"})
		return
	}

	data.Records = FormatDNSResult(result)
	if req.RequestId != 0 {
		if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
		}
	}

	c.JSON(http.StatusOK, data)

}

func FormatDNSResult(result *checker.DnsResponse) map[string][]string {
	return map[string][]string{
		"A":     result.A,
		"AAAA":  result.AAAA,
		"CNAME": {result.CNAME},
		"MX":    result.MX,
		"NS":    result.NS,
		"TXT":   result.TXT,
	}
}

func EvaluateDNSAssertions(rawAssertions []json.RawMessage, response *checker.DnsResponse) (bool, error) {
	for _, a := range rawAssertions {
		var assert assertions.RecordTarget
		if err := json.Unmarshal(a, &assert); err != nil {
			return false, fmt.Errorf("unable to parse assertion: %w", err)
		}
		var isSuccessfull bool
		switch assert.Key {
		case request.RecordA:
			isSuccessfull = assert.RecordEvaluate(response.A)
		case request.RecordAAAA:
			isSuccessfull = assert.RecordEvaluate(response.AAAA)
		case request.RecordCNAME:
			isSuccessfull = assert.RecordEvaluate([]string{response.CNAME})
		case request.RecordMX:
			isSuccessfull = assert.RecordEvaluate(response.MX)
		case request.RecordNS:
			isSuccessfull = assert.RecordEvaluate(response.NS)
		case request.RecordTXT:
			isSuccessfull = assert.RecordEvaluate(response.TXT)
		default:
			return false, fmt.Errorf("unknown record type in assertion: %s", assert.Key)
		}
		if !isSuccessfull {
			return false, nil
		}
	}
	return true, nil
}
