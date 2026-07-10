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

// AssertionResult tracks the results of running assertions
type AssertionResult struct {
	Type    string
	Success bool
	Message string
}

// TCPPrivateRegionData represents the result of a TCP monitor check
type TCPPrivateRegionData struct {
	ID            string `json:"id"`
	URI           string `json:"uri"`
	RequestStatus string `json:"request_status"`
	Message       string `json:"message"`
	Latency       int64  `json:"latency"`
	Timestamp     int64  `json:"timestamp"`
	CronTimestamp int64  `json:"cron_timestamp"`
	Error         int    `json:"error"`
	Timing        string `json:"timing"`
}

// runAssertions performs all configured assertions for TCP and returns their results

func (jobRunner) TCPJob(ctx context.Context, monitor *v1.TCPMonitor, region string) (*TCPPrivateRegionData, error) {
	retry := monitor.Retry
	if retry == 0 {
		retry = 3
	}

	var degradedAfter int64
	if monitor.DegradedAt != nil {
		degradedAfter = *monitor.DegradedAt
	}

	req := tcpCheckerRequest(monitor)

	var called int
	var lastResult checker.TCPResponse

	op := func() (*TCPPrivateRegionData, error) {
		called++
		res, err := checker.PingTCP(int(monitor.Timeout), monitor.Uri)
		if err != nil {
			if called < int(retry) {
				return nil, fmt.Errorf("TCP connection failed: %w", err)
			}
			// On final attempt, return the error in the result
			id, uuidErr := uuid.NewV7()
			if uuidErr != nil {
				return nil, fmt.Errorf("failed to generate UUID: %w", uuidErr)
			}

			lastResult = checker.TCPResponse{Error: 1}

			return &TCPPrivateRegionData{
				ID:            id.String(),
				Latency:       0,
				Timestamp:     res.TCPStart,
				CronTimestamp: res.TCPStart,
				URI:           monitor.Uri,
				RequestStatus: "error",
				Error:         1,
				Message:       err.Error(),
			}, nil
		}

		latency := res.TCPDone - res.TCPStart
		lastResult = checker.TCPResponse{Latency: latency, Timing: res}

		var requestStatus = "active"

		if degradedAfter > 0 && latency > degradedAfter {
			requestStatus = "degraded"
		}

		id, err := uuid.NewV7()
		if err != nil {
			return nil, fmt.Errorf("failed to generate UUID: %w", err)
		}
		timingAsString, err := json.Marshal(res)
		if err != nil {
			return nil, fmt.Errorf("error while parsing timing data %s: %w", monitor.Uri, err)
		}

		data := &TCPPrivateRegionData{
			ID:            id.String(),
			Latency:       latency,
			Timestamp:     res.TCPStart,
			CronTimestamp: res.TCPStart,
			URI:           monitor.Uri,
			RequestStatus: requestStatus,
			Error:         0,
			Message:       fmt.Sprintf("Successfully connected to %s", monitor.Uri),
			Timing:        string(timingAsString),
		}

		return data, nil
	}

	resp, err := backoff.Retry(ctx, op,
		backoff.WithMaxTries(uint(retry)),
		backoff.WithBackOff(backoff.NewExponentialBackOff()),
	)

	recordTCPOtel(ctx, req, lastResult, region, err != nil)

	if err != nil {
		return nil, fmt.Errorf("TCP job failed after %d retries: %w", retry, err)
	}
	return resp, nil
}

func tcpCheckerRequest(monitor *v1.TCPMonitor) request.TCPCheckerRequest {
	req := request.TCPCheckerRequest{URI: monitor.Uri}
	if otelCfg := monitor.GetOtelConfig(); otelCfg.GetEndpoint() != "" {
		req.OtelConfig.Endpoint = otelCfg.GetEndpoint()
		req.OtelConfig.Headers = headersToMap(otelCfg.GetHeaders())
	}

	return req
}

func recordTCPOtel(ctx context.Context, req request.TCPCheckerRequest, result checker.TCPResponse, region string, failed bool) {
	if req.OtelConfig.Endpoint == "" {
		return
	}

	if failed {
		result.Error = 1
	}

	otel.RecordTCPMetrics(ctx, req, result, region)
}
