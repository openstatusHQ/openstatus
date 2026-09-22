package job

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/cenkalti/backoff/v5"
	"github.com/google/uuid"
	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/otel"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

// ICMPPrivateRegionData represents the result of an ICMP monitor check
type ICMPPrivateRegionData struct {
	ID              string `json:"id"`
	URI             string `json:"uri"`
	RequestStatus   string `json:"request_status"`
	Message         string `json:"message"`
	Latency         int64  `json:"latency"`
	LatencyMin      int64  `json:"latency_min"`
	LatencyMax      int64  `json:"latency_max"`
	PacketsSent     int64  `json:"packets_sent"`
	PacketsReceived int64  `json:"packets_received"`
	Timestamp       int64  `json:"timestamp"`
	CronTimestamp   int64  `json:"cron_timestamp"`
	Error           int    `json:"error"`
	Timing          string `json:"timing"`
}

func (jobRunner) ICMPJob(ctx context.Context, monitor *v1.ICMPMonitor, region string) (*ICMPPrivateRegionData, error) {
	retry := monitor.Retry
	if retry == 0 {
		retry = 3
	}

	var degradedAfter int64
	if monitor.DegradedAt != nil {
		degradedAfter = *monitor.DegradedAt
	}

	req := icmpCheckerRequest(monitor)

	var called int
	var lastResult checker.ICMPResponse

	op := func() (*ICMPPrivateRegionData, error) {
		called++
		start := time.Now().UTC().UnixMilli()
		res, err := checker.PingICMP(monitor.Timeout, monitor.Uri)
		if err != nil {
			if called < int(retry) {
				return nil, fmt.Errorf("ICMP check failed: %w", err)
			}

			data, dataErr := newICMPData(monitor.Uri, start)
			if dataErr != nil {
				return nil, dataErr
			}

			lastResult = checker.ICMPResponse{Error: 1}

			data.RequestStatus = "error"
			data.Error = 1
			data.Message = err.Error()

			return data, nil
		}

		lastResult = checker.ICMPResponse{
			Latency:         res.Latency,
			LatencyMin:      res.LatencyMin,
			LatencyMax:      res.LatencyMax,
			PacketsSent:     res.PacketsSent,
			PacketsReceived: res.PacketsReceived,
			Timing:          res.Timing,
		}

		// "success", not "active": the Tinybird ICMP status and uptime pipes
		// count `requestStatus = 'success'`, and the HTTP/TCP/DNS jobs all
		// report it that way.
		var requestStatus = "success"
		if degradedAfter > 0 && res.Latency > degradedAfter {
			requestStatus = "degraded"
		}

		data, err := newICMPData(monitor.Uri, start)
		if err != nil {
			return nil, err
		}

		timingAsString, err := json.Marshal(res.Timing)
		if err != nil {
			return nil, fmt.Errorf("error while parsing timing data %s: %w", monitor.Uri, err)
		}

		data.Latency = res.Latency
		data.LatencyMin = res.LatencyMin
		data.LatencyMax = res.LatencyMax
		data.PacketsSent = int64(res.PacketsSent)
		data.PacketsReceived = int64(res.PacketsReceived)
		data.RequestStatus = requestStatus
		data.Error = 0
		data.Message = fmt.Sprintf("Successfully pinged %s", monitor.Uri)
		data.Timing = string(timingAsString)

		return data, nil
	}

	resp, err := backoff.Retry(ctx, op,
		backoff.WithMaxTries(uint(retry)),
		backoff.WithBackOff(backoff.NewExponentialBackOff()),
	)

	recordICMPOtel(ctx, req, lastResult, region, err != nil)

	if err != nil {
		return nil, fmt.Errorf("ICMP job failed after %d retries: %w", retry, err)
	}
	return resp, nil
}

// newICMPData stamps the fields every result must carry regardless of outcome.
// `Timestamp`/`CronTimestamp` are required: ValidateIngestICMPRequest rejects a
// non-positive timestamp, so a result missing them is dropped at ingest.
func newICMPData(uri string, start int64) (*ICMPPrivateRegionData, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return nil, fmt.Errorf("failed to generate UUID: %w", err)
	}

	return &ICMPPrivateRegionData{
		ID:            id.String(),
		URI:           uri,
		Timestamp:     start,
		CronTimestamp: start,
	}, nil
}

func icmpCheckerRequest(monitor *v1.ICMPMonitor) request.ICMPCheckerRequest {
	req := request.ICMPCheckerRequest{URI: monitor.Uri}
	if otelCfg := monitor.GetOtelConfig(); otelCfg.GetEndpoint() != "" {
		req.OtelConfig.Endpoint = otelCfg.GetEndpoint()
		req.OtelConfig.Headers = headersToMap(otelCfg.GetHeaders())
	}

	return req
}

func recordICMPOtel(ctx context.Context, req request.ICMPCheckerRequest, result checker.ICMPResponse, region string, failed bool) {
	if req.OtelConfig.Endpoint == "" {
		return
	}

	if failed {
		result.Error = 1
	}

	otel.RecordICMPMetrics(ctx, req, result, region)
}
