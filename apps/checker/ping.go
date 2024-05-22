package checker

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"os"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

type PingData struct {
	WorkspaceID   string `json:"workspaceId"`
	MonitorID     string `json:"monitorId"`
	Timestamp     int64  `json:"timestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Latency       int64  `json:"latency"`
	CronTimestamp int64  `json:"cronTimestamp"`
	URL           string `json:"url"`
	Region        string `json:"region"`
	Message       string `json:"message,omitempty"`
	Timing        string `json:"timing,omitempty"`
	Headers       string `json:"headers,omitempty"`
	Error         uint8  `json:"error"`
	Assertions    string `json:"assertions"`
	Body          string `json:"body,omitempty"`
}

type Timing struct {
	DnsStart          int64 `json:"dnsStart"`
	DnsDone           int64 `json:"dnsDone"`
	ConnectStart      int64 `json:"connectStart"`
	ConnectDone       int64 `json:"connectDone"`
	TlsHandshakeStart int64 `json:"tlsHandshakeStart"`
	TlsHandshakeDone  int64 `json:"tlsHandshakeDone"`
	FirstByteStart    int64 `json:"firstByteStart"`
	FirstByteDone     int64 `json:"firstByteDone"`
	TransferStart     int64 `json:"transferStart"`
	TransferDone      int64 `json:"transferDone"`
}

type Response struct {
	Status  int               `json:"status,omitempty"`
	Latency int64             `json:"latency"`
	Body    string            `json:"body,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Time    int64             `json:"time"`
	Timing  Timing            `json:"timing"`
	Error   string            `json:"error,omitempty"`
	Tags    []string          `json:"tags,omitempty"`
}

func Ping(ctx context.Context, client *http.Client, inputData request.CheckerRequest) (PingData, error) {
	logger := log.Ctx(ctx).With().Str("monitor", inputData.URL).Logger()
	region := os.Getenv("FLY_REGION")
	req, err := http.NewRequestWithContext(ctx, inputData.Method, inputData.URL, bytes.NewReader([]byte(inputData.Body)))
	if err != nil {
		logger.Error().Err(err).Msg("error while creating req")
		return PingData{}, fmt.Errorf("unable to create req: %w", err)
	}
	req.Header.Set("User-Agent", "OpenStatus/1.0")
	for _, header := range inputData.Headers {
		if header.Key != "" {
			req.Header.Set(header.Key, header.Value)
		}
	}
	if inputData.Method != http.MethodGet {
		req.Header.Set("Content-Type", "application/json")
	}

	timing := Timing{}

	trace := &httptrace.ClientTrace{
		DNSStart:          func(_ httptrace.DNSStartInfo) { timing.DnsStart = time.Now().UTC().UnixMilli() },
		DNSDone:           func(_ httptrace.DNSDoneInfo) { timing.DnsDone = time.Now().UTC().UnixMilli() },
		ConnectStart:      func(_, _ string) { timing.ConnectStart = time.Now().UTC().UnixMilli() },
		ConnectDone:       func(_, _ string, _ error) { timing.ConnectDone = time.Now().UTC().UnixMilli() },
		TLSHandshakeStart: func() { timing.TlsHandshakeStart = time.Now().UTC().UnixMilli() },
		TLSHandshakeDone:  func(_ tls.ConnectionState, _ error) { timing.TlsHandshakeDone = time.Now().UTC().UnixMilli() },
		GotConn: func(_ httptrace.GotConnInfo) {
			timing.FirstByteStart = time.Now().UTC().UnixMilli()
		},
		GotFirstResponseByte: func() {
			timing.FirstByteDone = time.Now().UTC().UnixMilli()
			timing.TransferStart = time.Now().UTC().UnixMilli()
		},
	}

	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	start := time.Now()

	response, err := client.Do(req)
	timing.TransferDone = time.Now().UTC().UnixMilli()
	latency := time.Since(start).Milliseconds()
	if err != nil {
		timingAsString, err2 := json.Marshal(timing)
		if err2 != nil {
			logger.Error().Err(err2).Msg("error while parsing timing data")
		}
		var urlErr *url.Error
		if errors.As(err, &urlErr) && urlErr.Timeout() {
			return PingData{
				Latency:       latency,
				MonitorID:     inputData.MonitorID,
				Region:        region,
				WorkspaceID:   inputData.WorkspaceID,
				Timestamp:     start.UTC().UnixMilli(),
				CronTimestamp: inputData.CronTimestamp,
				URL:           inputData.URL,
				Message:       fmt.Sprintf("Timeout after %d ms", latency),
				Timing:        string(timingAsString),
			}, nil
		}

		logger.Error().Err(err).Msg("error while pinging")
		return PingData{}, fmt.Errorf("error with monitorURL %s: %w", inputData.URL, err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return PingData{
			Latency:       latency,
			MonitorID:     inputData.MonitorID,
			Region:        region,
			WorkspaceID:   inputData.WorkspaceID,
			Timestamp:     start.UTC().UnixMilli(),
			CronTimestamp: inputData.CronTimestamp,
			URL:           inputData.URL,
			Message:       fmt.Sprintf("Cannot read response body: %s", err.Error()),
		}, fmt.Errorf("error with monitorURL %s: %w", inputData.URL, err)
	}

	headers := make(map[string]string)
	for key := range response.Header {
		headers[key] = response.Header.Get(key)
	}

	// In TB we need to store them as string
	timingAsString, err := json.Marshal(timing)
	if err != nil {
		return PingData{}, fmt.Errorf("error while parsing timing data %s: %w", inputData.URL, err)
	}

	headersAsString, err := json.Marshal(headers)
	if err != nil {
		return PingData{}, fmt.Errorf("error while parsing headers %s: %w", inputData.URL, err)
	}

	return PingData{
		Latency:       latency,
		StatusCode:    response.StatusCode,
		MonitorID:     inputData.MonitorID,
		Region:        region,
		WorkspaceID:   inputData.WorkspaceID,
		Timestamp:     start.UTC().UnixMilli(),
		CronTimestamp: inputData.CronTimestamp,
		URL:           inputData.URL,
		Timing:        string(timingAsString),
		Headers:       string(headersAsString),
		Body:          string(body),
	}, nil
}

func SinglePing(ctx context.Context, client *http.Client, inputData request.PingRequest) (Response, error) {
	logger := log.Ctx(ctx).With().Str("monitor", inputData.URL).Logger()

	req, err := http.NewRequestWithContext(ctx, inputData.Method, inputData.URL, bytes.NewReader([]byte(inputData.Body)))
	if err != nil {
		logger.Error().Err(err).Msg("error while creating req")
		return Response{}, fmt.Errorf("unable to create req: %w", err)
	}

	req.Header.Set("User-Agent", "OpenStatus/1.0")
	for key, value := range inputData.Headers {
		req.Header.Set(key, value)
	}
	if inputData.Method != http.MethodGet {
		req.Header.Set("Content-Type", "application/json")
	}
	timing := Timing{}

	trace := &httptrace.ClientTrace{
		DNSStart:          func(_ httptrace.DNSStartInfo) { timing.DnsStart = time.Now().UTC().UnixMilli() },
		DNSDone:           func(_ httptrace.DNSDoneInfo) { timing.DnsDone = time.Now().UTC().UnixMilli() },
		ConnectStart:      func(_, _ string) { timing.ConnectStart = time.Now().UTC().UnixMilli() },
		ConnectDone:       func(_, _ string, _ error) { timing.ConnectDone = time.Now().UTC().UnixMilli() },
		TLSHandshakeStart: func() { timing.TlsHandshakeStart = time.Now().UTC().UnixMilli() },
		TLSHandshakeDone:  func(_ tls.ConnectionState, _ error) { timing.TlsHandshakeDone = time.Now().UTC().UnixMilli() },
		GotConn: func(_ httptrace.GotConnInfo) {
			timing.FirstByteStart = time.Now().UTC().UnixMilli()
		},
		GotFirstResponseByte: func() {
			timing.FirstByteDone = time.Now().UTC().UnixMilli()
			timing.TransferStart = time.Now().UTC().UnixMilli()
		},
	}

	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	start := time.Now()
	res, err := client.Do(req)
	timing.TransferDone = time.Now().UTC().UnixMilli()
	latency := time.Since(start).Milliseconds()

	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) && urlErr.Timeout() {
			return Response{
				Latency: latency,
				Timing:  timing,
				Time:    start.UTC().UnixMilli(),
				Error:   fmt.Sprintf("Timeout after %d ms", latency),
			}, nil
		}

		logger.Error().Err(err).Msg("error while pinging")
		return Response{}, fmt.Errorf("error with monitorURL %s: %w", inputData.URL, err)
	}
	defer res.Body.Close()

	headers := make(map[string]string)
	for key := range res.Header {
		headers[key] = res.Header.Get(key)
	}

	return Response{
		Time:    start.UTC().UnixMilli(),
		Status:  res.StatusCode,
		Headers: headers,
		Timing:  timing,
		Latency: latency,
	}, nil
}
