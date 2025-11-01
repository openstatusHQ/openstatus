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
	ID            string              `json:"id"`
	Timing        string              `json:"timing"`
	ErrorMessage  string              `json:"errorMessage"`
	Region        string              `json:"region"`
	Trigger       string              `json:"trigger"`
	URI           string              `json:"uri"`
	RequestStatus string              `json:"requestStatus,omitempty"`
	Records       map[string][]string `json:"records"`

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

	var called int

	var retry int
	if req.Retry == 0 {
		retry = int(req.Retry)
	} else {
		retry = 3
	}

	id, e := uuid.NewV7()
	if e != nil {
		log.Ctx(ctx).Error().Err(e).Msg("failed to send event to tinybird")
		return
	}

	var requestStatus = ""
	switch req.Status {
	case "active":
		requestStatus = "success"
	case "error":
		requestStatus = "error"
	case "degraded":
		requestStatus = "degraded"
	}

	data := DNSResponse{
		ID:            id.String(),
		Region:        h.Region,
		Trigger:       trigger,
		URI:           req.URI,
		WorkspaceID:   workspaceId,
		MonitorID:     monitorId,
		CronTimestamp: req.CronTimestamp,
		RequestStatus: requestStatus,
	}

	var latency int64
	var isSuccessfull bool = true

	op := func() (*checker.DnsResponse, error) {
		called++

		start := time.Now().UTC().UnixMilli()

		response, err := checker.Dns(ctx, req.URI)
		stop := time.Now().UTC().UnixMilli()

		latency = stop - start
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("dns check failed")
			return nil, err
		}
		if len(req.RawAssertions) > 0 {
			isSuccessfull, err = EvaluateDNSAssertions(req.RawAssertions, response)
			if err != nil {
				return nil, err
			}
		}
		if !isSuccessfull && called < retry {
			return nil, fmt.Errorf("assertion failed for record type")
		}
		return response, err
	}

	result, err := backoff.Retry(ctx, op, backoff.WithBackOff(backoff.NewExponentialBackOff()), backoff.WithMaxTries(uint(retry)))


	r := FormatDNSResult(result)
	data.Latency = latency
	data.Records = r

	if !isSuccessfull && req.Status != "error" {
		// Q: Why here we do not check if the status was previously active?
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     req.MonitorID,
			Status:        "error",
			Region:        h.Region,
			Message:       err.Error(),
			CronTimestamp: req.CronTimestamp,
			Latency:       latency,
		})
		data.RequestStatus = "error"
	}
	// it's degraded
	if isSuccessfull && req.DegradedAfter > 0 &&latency > req.DegradedAfter && req.Status != "degraded" {
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     req.MonitorID,
			Status:        "degraded",
			Region:        h.Region,
			CronTimestamp: req.CronTimestamp,
			Latency:       latency,
		})
		data.RequestStatus = "degraded"
	}
	// it's active
	if isSuccessfull && req.DegradedAfter == 0 && req.Status != "active" {
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     req.MonitorID,
			Status:        "active",
			Region:        h.Region,
			CronTimestamp: req.CronTimestamp,
			Latency:       latency,
		})
		data.RequestStatus = "success"
	}
	// it's active
	if isSuccessfull && latency < req.DegradedAfter && req.DegradedAfter != 0 && req.Status != "active" {
		checker.UpdateStatus(ctx, checker.UpdateData{
			MonitorId:     req.MonitorID,
			Status:        "active",
			Region:        h.Region,
			CronTimestamp: req.CronTimestamp,
		})
		data.RequestStatus = "success"
	}

	if err := h.TbClient.SendEvent(ctx, data, dataSourceName); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
	}

	returnData := c.Query("data")
	if returnData == "true" {
		c.JSON(http.StatusOK, data)
		return
	}

	c.JSON(http.StatusOK, nil)
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
