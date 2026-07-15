package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/openstatushq/openstatus/apps/checker/request"
)

// ProxyRequest is the payload the checker POSTs to a user-provided proxy.
// The proxy performs the actual HTTP check against URL and reports the
// measured result back, so the recorded latency reflects the proxy's vantage
// point (e.g. a serverless function running in a region without a probe).
type ProxyRequest struct {
	Headers         map[string]string `json:"headers,omitempty"`
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Body            string            `json:"body,omitempty"`
	Timeout         int64             `json:"timeout"`
	FollowRedirects bool              `json:"followRedirects"`
}

// ProxyResponse is what the checker expects back from the proxy.
// On a completed check, `status` and `latency` are required. If the target
// could not be reached, the proxy should set `error` (and optionally
// `latency`) instead. `region` lets the proxy report its own location and is
// used when the monitor has no explicit proxy region configured. Everything
// else is optional.
type ProxyResponse struct {
	Headers   map[string]string `json:"headers,omitempty"`
	Body      string            `json:"body,omitempty"`
	Error     string            `json:"error,omitempty"`
	Region    string            `json:"region,omitempty"`
	Timing    Timing            `json:"timing"`
	Latency   int64             `json:"latency"`
	Timestamp int64             `json:"timestamp,omitempty"`
	Status    int               `json:"status,omitempty"`
}

// HttpViaProxy runs an HTTP check through a user-provided proxy instead of
// hitting the target directly. The proxy measures the request from its own
// location and returns the result following the ProxyResponse contract.
func HttpViaProxy(ctx context.Context, client *http.Client, inputData request.HttpCheckerRequest) (Response, error) {
	logger := log.Ctx(ctx).With().Str("monitor", inputData.URL).Str("proxy", inputData.ProxyURL).Logger()

	headers := make(map[string]string)
	for _, header := range inputData.Headers {
		if header.Key != "" {
			headers[header.Key] = header.Value
		}
	}

	payload, err := json.Marshal(ProxyRequest{
		URL:             inputData.URL,
		Method:          inputData.Method,
		Headers:         headers,
		Body:            inputData.Body,
		Timeout:         inputData.Timeout,
		FollowRedirects: inputData.FollowRedirects,
	})
	if err != nil {
		return Response{}, fmt.Errorf("unable to marshal proxy request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, inputData.ProxyURL, bytes.NewReader(payload))
	if err != nil {
		logger.Error().Err(err).Msg("error while creating proxy req")
		return Response{}, fmt.Errorf("unable to create proxy req: %w", err)
	}
	req.Header.Set("User-Agent", "OpenStatus/1.0")
	req.Header.Set("Content-Type", "application/json")
	for _, header := range inputData.ProxyHeaders {
		if header.Key != "" {
			req.Header.Set(header.Key, header.Value)
		}
	}

	start := time.Now()

	response, err := client.Do(req)
	if err != nil {
		logger.Error().Err(err).Msg("error while calling proxy")
		return Response{}, fmt.Errorf("unable to call proxy: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return Response{}, fmt.Errorf("unable to read proxy response body: %w", err)
	}

	if response.StatusCode != http.StatusOK {
		return Response{}, fmt.Errorf("proxy returned status %d: %s", response.StatusCode, string(body))
	}

	var proxyRes ProxyResponse
	if err := json.Unmarshal(body, &proxyRes); err != nil {
		return Response{}, fmt.Errorf("unable to decode proxy response: %w", err)
	}

	timestamp := proxyRes.Timestamp
	if timestamp == 0 {
		timestamp = start.UTC().UnixMilli()
	}

	// the proxy reached its own network error while checking the target
	if proxyRes.Error != "" {
		return Response{
			Latency:   proxyRes.Latency,
			Timing:    proxyRes.Timing,
			Timestamp: timestamp,
			Region:    proxyRes.Region,
			Error:     proxyRes.Error,
		}, nil
	}

	if proxyRes.Status == 0 {
		return Response{}, fmt.Errorf("proxy response is missing the status field")
	}

	return Response{
		Timestamp: timestamp,
		Status:    proxyRes.Status,
		Headers:   proxyRes.Headers,
		Timing:    proxyRes.Timing,
		Latency:   proxyRes.Latency,
		Body:      proxyRes.Body,
		Region:    proxyRes.Region,
	}, nil
}
