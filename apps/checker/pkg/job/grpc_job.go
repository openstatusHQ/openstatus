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

// GRPCPrivateRegionData represents the result of a gRPC monitor check
type GRPCPrivateRegionData struct {
	ID            string `json:"id"`
	URI           string `json:"uri"`
	Service       string `json:"service"`
	ServingStatus string `json:"serving_status"`
	RequestStatus string `json:"request_status"`
	Message       string `json:"message"`
	Latency       int64  `json:"latency"`
	GRPCCode      int64  `json:"grpc_code"`
	Timestamp     int64  `json:"timestamp"`
	CronTimestamp int64  `json:"cron_timestamp"`
	Error         int    `json:"error"`
	Timing        string `json:"timing"`
}

func (jobRunner) GRPCJob(ctx context.Context, monitor *v1.GRPCMonitor, region string) (*GRPCPrivateRegionData, error) {
	retry := monitor.Retry
	if retry == 0 {
		retry = 3
	}

	var degradedAfter int64
	if monitor.DegradedAt != nil {
		degradedAfter = *monitor.DegradedAt
	}

	req := grpcCheckerRequest(monitor)

	var called int
	var lastResult checker.GRPCResponse

	op := func() (*GRPCPrivateRegionData, error) {
		called++
		start := time.Now().UTC().UnixMilli()

		res, err := checker.CheckGRPC(
			monitor.Timeout,
			monitor.Uri,
			monitor.Service,
			checker.ParseGRPCTLSMode(monitor.TlsMode),
			headersToMap(monitor.GetMetadata()),
		)
		if err != nil {
			// Only a call that never reached the server is worth repeating.
			if called < int(retry) {
				return nil, fmt.Errorf("gRPC check failed: %w", err)
			}

			data, dataErr := newGRPCData(monitor.Uri, monitor.Service, start)
			if dataErr != nil {
				return nil, dataErr
			}

			lastResult = checker.GRPCResponse{Error: 1, GRPCCode: res.GRPCCode}

			data.RequestStatus = "error"
			data.Error = 1
			data.GRPCCode = res.GRPCCode
			data.Message = err.Error()
			data.Timing = marshalGRPCTiming(res.Timing)

			return data, nil
		}

		// The server answered. Whatever it said, asking again cannot change it,
		// so this path never returns an error to the retry loop.
		errorFlag := 0
		if !res.Healthy {
			errorFlag = 1
		}

		lastResult = checker.GRPCResponse{
			Latency:       res.Latency,
			Timing:        res.Timing,
			ServingStatus: res.ServingStatus,
			GRPCCode:      res.GRPCCode,
			Completed:     true,
			Error:         uint8(errorFlag),
		}

		// "success", not "active": the Tinybird gRPC status and uptime pipes
		// count `requestStatus = 'success'`, and the other jobs report it that way.
		requestStatus := "success"
		switch {
		case !res.Healthy:
			requestStatus = "error"
		case degradedAfter > 0 && res.Latency > degradedAfter:
			requestStatus = "degraded"
		}

		data, err := newGRPCData(monitor.Uri, monitor.Service, start)
		if err != nil {
			return nil, err
		}

		data.Latency = res.Latency
		data.GRPCCode = res.GRPCCode
		data.ServingStatus = res.ServingStatus
		data.RequestStatus = requestStatus
		data.Error = errorFlag
		data.Message = res.Message
		data.Timing = marshalGRPCTiming(res.Timing)

		return data, nil
	}

	resp, err := backoff.Retry(ctx, op,
		backoff.WithMaxTries(uint(retry)),
		backoff.WithBackOff(backoff.NewExponentialBackOff()),
	)

	recordGRPCOtel(ctx, req, lastResult, region, err != nil)

	if err != nil {
		return nil, fmt.Errorf("gRPC job failed after %d retries: %w", retry, err)
	}

	return resp, nil
}

// newGRPCData stamps the fields every result must carry regardless of outcome.
// `Timestamp`/`CronTimestamp` are required: ValidateIngestGRPCRequest rejects a
// non-positive timestamp, so a result missing them is dropped at ingest.
func newGRPCData(uri, service string, start int64) (*GRPCPrivateRegionData, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return nil, fmt.Errorf("failed to generate UUID: %w", err)
	}

	return &GRPCPrivateRegionData{
		ID:            id.String(),
		URI:           uri,
		Service:       service,
		Timestamp:     start,
		CronTimestamp: start,
	}, nil
}

// marshalGRPCTiming keeps whatever phases completed. A transport failure still
// carries the ones it got through, which is what separates a DNS failure from a
// TLS one once the row is in Tinybird.
func marshalGRPCTiming(timing checker.GRPCResponseTiming) string {
	encoded, err := json.Marshal(timing)
	if err != nil {
		return ""
	}

	return string(encoded)
}

func grpcCheckerRequest(monitor *v1.GRPCMonitor) request.GRPCCheckerRequest {
	req := request.GRPCCheckerRequest{
		URI:     monitor.Uri,
		Service: monitor.Service,
		TLS:     monitor.TlsMode,
		Headers: headersToMap(monitor.GetMetadata()),
	}
	if otelCfg := monitor.GetOtelConfig(); otelCfg.GetEndpoint() != "" {
		req.OtelConfig.Endpoint = otelCfg.GetEndpoint()
		req.OtelConfig.Headers = headersToMap(otelCfg.GetHeaders())
	}

	return req
}

func recordGRPCOtel(ctx context.Context, req request.GRPCCheckerRequest, result checker.GRPCResponse, region string, failed bool) {
	if req.OtelConfig.Endpoint == "" {
		return
	}

	if failed {
		result.Error = 1
		result.Completed = false
	}

	otel.RecordGRPCMetrics(ctx, req, result, region)
}
