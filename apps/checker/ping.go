package checker

import (
	"bytes"
	"context"
	"crypto/tls"
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
	WorkspaceID   string            `json:"workspaceId"`
	MonitorID     string            `json:"monitorId"`
	Timestamp     int64             `json:"timestamp"`
	StatusCode    int               `json:"statusCode,omitempty"`
	Latency       int64             `json:"latency"`
	CronTimestamp int64             `json:"cronTimestamp"`
	URL           string            `json:"url"`
	Region        string            `json:"region"`
	Message       string            `json:"message,omitempty"`
	Timing        Timing            `json:"timing,omitempty"`
	Headers       map[string]string `json:"headers,omitempty"`
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

	timing := Timing{}

	trace := &httptrace.ClientTrace{
		DNSStart:          func(_ httptrace.DNSStartInfo) { timing.DnsStart = time.Now().UnixMilli() },
		DNSDone:           func(_ httptrace.DNSDoneInfo) { timing.DnsDone = time.Now().UnixMilli() },
		ConnectStart:      func(_, _ string) { timing.ConnectStart = time.Now().UnixMilli() },
		ConnectDone:       func(_, _ string, _ error) { timing.ConnectDone = time.Now().UnixMilli() },
		TLSHandshakeStart: func() { timing.TlsHandshakeStart = time.Now().UnixMilli() },
		TLSHandshakeDone:  func(_ tls.ConnectionState, _ error) { timing.TlsHandshakeDone = time.Now().UnixMilli() },
		GotConn: func(_ httptrace.GotConnInfo) {
			timing.FirstByteStart = time.Now().UnixMilli()
		},
		GotFirstResponseByte: func() {
			timing.FirstByteDone = time.Now().UnixMilli()
			timing.TransferStart = time.Now().UnixMilli()
		},
	}

	start := time.Now()

	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	response, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) && urlErr.Timeout() {
			return PingData{
				Latency:     latency,
				MonitorID:   inputData.MonitorID,
				Region:      region,
				WorkspaceID: inputData.WorkspaceID,
				Timestamp:   time.Now().UTC().UnixMilli(),
				URL:         inputData.URL,
				Message:     fmt.Sprintf("Timeout after %d ms", latency),
				Timing:      timing,
			}, nil
		}

		logger.Error().Err(err).Msg("error while pinging")
		return PingData{}, fmt.Errorf("error with monitorURL %s: %w", inputData.URL, err)
	}
	defer response.Body.Close()

	_, err = io.ReadAll(response.Body)
	if err != nil {
		return PingData{}, fmt.Errorf("error with monitorURL %s: %w", inputData.URL, err)
	}

	headers := make(map[string]string)
	for key := range response.Header {
		headers[key] = response.Header.Get(key)
	}

	return PingData{
		Latency:       latency,
		StatusCode:    response.StatusCode,
		MonitorID:     inputData.MonitorID,
		Region:        region,
		WorkspaceID:   inputData.WorkspaceID,
		Timestamp:     time.Now().UTC().UnixMilli(),
		CronTimestamp: inputData.CronTimestamp,
		URL:           inputData.URL,
		Timing:        timing,
		Headers:       headers,
	}, nil
}
