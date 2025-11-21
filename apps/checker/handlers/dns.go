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

	// Authorization check
	if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", h.Secret) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Fly region forwarding
	if h.CloudProvider == "fly" {
		region := c.GetHeader("fly-prefer-region")
		if region != "" && region != h.Region {
			c.Header("fly-replay", fmt.Sprintf("region=%s", region))
			c.String(http.StatusAccepted, "Forwarding request to %s", region)
			return
		}
	}

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

	statusMap := map[string]string{
		"active":   "success",
		"error":    "error",
		"degraded": "degraded",
	}
	requestStatus := statusMap[req.Status]

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
	data.Records = FormatDNSResult(result)

	if len(req.RawAssertions) > 0 {
		if j, err := json.Marshal(req.RawAssertions); err == nil {
			data.Assertions = string(j)
		} else {
			log.Ctx(ctx).Error().Err(err).Msg("failed to marshal assertions")
		}
	}

	// Status update logic
	switch {
	case !isSuccessful && req.Status != "error":
		log.Ctx(ctx).Debug().Msg("DNS check failed assertions")
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     req.MonitorID,
			Status:        "error",
			Region:        h.Region,
			Message:       err.Error(),
			CronTimestamp: req.CronTimestamp,
			Latency:       latency,
		})
		data.RequestStatus = "error"
		data.Error = 1
		data.ErrorMessage = err.Error()
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

	c.JSON(http.StatusOK, data)
}

func (h Handler) DNSHandlerRegion(c *gin.Context) {
	ctx := c.Request.Context()
	dataSourceName := "check_dns_response__v0"
	const defaultRetry = 3

	// Authorization check
	if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", h.Secret) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Fly region forwarding
	if h.CloudProvider == "fly" {
		region := c.GetHeader("fly-prefer-region")
		if region != "" && region != h.Region {
			c.Header("fly-replay", fmt.Sprintf("region=%s", region))
			c.String(http.StatusAccepted, "Forwarding request to %s", region)
			return
		}
	}

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

	workspaceId , _ := strconv.Atoi(req.WorkspaceID)

	statusMap := map[string]string{
		"active":   "success",
		"error":    "error",
		"degraded": "degraded",
	}
	requestStatus := statusMap[req.Status]

	data := DNSResponse{
		ID:            id.String(),
		Region:        h.Region,
		URI:           req.URI,
		WorkspaceID:   int64(workspaceId),
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
	r := make(map[string][]string)
	a := make([]string, 0)
	aaaa := make([]string, 0)
	mx := make([]string, 0)
	ns := make([]string, 0)
	txt := make([]string, 0)
	for _, v := range result.A {
		a = append(a, v)
	}
	r["A"] = a

	for _, v := range result.AAAA {
		aaaa = append(aaaa, v)
	}
	r["AAAA"] = aaaa

	r["CNAME"] = []string{result.CNAME}
	for _, v := range result.MX {
		mx = append(mx, v)
	}
	r["MX"] = mx
	for _, v := range result.NS {
		ns = append(ns, v)
	}
	r["NS"] = ns
	for _, v := range result.TXT {
		txt = append(txt, v)
	}
	r["TXT"] = txt
	return r
}

func EvaluateDNSAssertions(rawAssertions []json.RawMessage, response *checker.DnsResponse) (bool, error) {
	for _, a := range rawAssertions {
		var assert assertions.RecordTarget
		if err := json.Unmarshal(a, &assert); err != nil {
			return false, fmt.Errorf("unable to parse assertion: %w", err)
		}
		var isSuccessfull bool
		switch assert.Record {
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
			return false, fmt.Errorf("unknown record type in assertion: %s", assert.Record)
		}
		if !isSuccessfull {
			return false, nil
		}
	}
	return true, nil
}
