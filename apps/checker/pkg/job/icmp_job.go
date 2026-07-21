package job

import (
	"context"
	"encoding/json"
	"fmt"

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
		res, err := checker.PingICMP(monitor.Timeout, monitor.Uri)
		if err != nil {
			if called < int(retry) {
				return nil, fmt.Errorf("ICMP check failed: %w", err)
			}
			id, uuidErr := uuid.NewV7()
			if uuidErr != nil {
				return nil, fmt.Errorf("failed to generate UUID: %w", uuidErr)
			}

			lastResult = checker.ICMPResponse{Error: 1}

			return &ICMPPrivateRegionData{
				ID:            id.String(),
				URI:           monitor.Uri,
				RequestStatus: "error",
				Error:         1,
				Message:       err.Error(),
			}, nil
		}

		lastResult = checker.ICMPResponse{
			Latency:         res.Latency,
			LatencyMin:      res.LatencyMin,
			LatencyMax:      res.LatencyMax,
			PacketsSent:     res.PacketsSent,
			PacketsReceived: res.PacketsReceived,
			Timing:          res.Timing,
		}

		var requestStatus = "active"
		if degradedAfter > 0 && res.Latency > degradedAfter {
			requestStatus = "degraded"
		}

		id, err := uuid.NewV7()
		if err != nil {
			return nil, fmt.Errorf("failed to generate UUID: %w", err)
		}
		timingAsString, err := json.Marshal(res.Timing)
		if err != nil {
			return nil, fmt.Errorf("error while parsing timing data %s: %w", monitor.Uri, err)
		}

		return &ICMPPrivateRegionData{
			ID:              id.String(),
			Latency:         res.Latency,
			LatencyMin:      res.LatencyMin,
			LatencyMax:      res.LatencyMax,
			PacketsSent:     int64(res.PacketsSent),
			PacketsReceived: int64(res.PacketsReceived),
			URI:             monitor.Uri,
			RequestStatus:   requestStatus,
			Error:           0,
			Message:         fmt.Sprintf("Successfully pinged %s", monitor.Uri),
			Timing:          string(timingAsString),
		}, nil
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
