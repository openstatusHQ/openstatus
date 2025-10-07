package checker

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"strings"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

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
	Headers   map[string]string `json:"headers,omitempty"`
	Body      string            `json:"body,omitempty"`
	Error     string            `json:"error,omitempty"`
	Region    string            `json:"region"`
	JobType   string            `json:"jobType"`
	Latency   int64             `json:"latency"`
	Timestamp int64             `json:"timestamp"`
	Status    int               `json:"status,omitempty"`
	Timing    Timing            `json:"timing"`
}

// decodeBase64Body decodes a data URL base64 body if needed
func decodeBase64Body(body string) ([]byte, error) {
	data := strings.Split(body, ",")
	if len(data) == 2 {
		return base64.StdEncoding.DecodeString(data[1])
	}
	return nil, fmt.Errorf("invalid base64 data url format")
}


// FIXME: This should only return the TCP Timing Data;
func Http(ctx context.Context, client *http.Client, inputData request.HttpCheckerRequest) (Response, error) {
	logger := log.Ctx(ctx).With().Str("monitor", inputData.URL).Logger()

	var bodyBytes []byte
	if inputData.Method == http.MethodPost {
		contentType := ""
		for _, header := range inputData.Headers {
			if header.Key == "Content-Type" {
				contentType = header.Value
				break
			}
		}
		if contentType == "application/octet-stream" {
			decoded, err := decodeBase64Body(inputData.Body)
			if err != nil {
				return Response{}, fmt.Errorf("error while decoding base64: %w", err)
			}
			bodyBytes = decoded
		} else {
			bodyBytes = []byte(inputData.Body)
		}
	} else {
		bodyBytes = []byte(inputData.Body)
	}

	req, err := http.NewRequestWithContext(ctx, inputData.Method, inputData.URL, bytes.NewReader(bodyBytes))
	if err != nil {
		logger.Error().Err(err).Msg("error while creating req")
		return Response{}, fmt.Errorf("unable to create req: %w", err)
	}
	req.Header.Set("User-Agent", "OpenStatus/1.0")
	for _, header := range inputData.Headers {
		if header.Key != "" {
			req.Header.Set(header.Key, header.Value)
		}
	}

	// Maybe we should remove the default post to application JSON
	// Default POST Content-Type
	if inputData.Method == http.MethodPost && req.Header.Get("Content-Type") == "" {
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
	latency := time.Since(start).Milliseconds()

	if err != nil {

		var urlErr *url.Error
		if errors.As(err, &urlErr) && urlErr.Timeout() {
			return Response{
				Latency:   latency,
				Timing:    timing,
				Timestamp: start.UTC().UnixMilli(),
				Error:     fmt.Sprintf("Timeout after %d ms", latency),
			}, nil
		}

		logger.Error().Err(err).Msg("error while pinging")

		return Response{}, err
	}

	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)

	timing.TransferDone = time.Now().UTC().UnixMilli()

	if err != nil {
		return Response{
			Latency:   latency,
			Timing:    timing,
			Timestamp: start.UTC().UnixMilli(),
			Error:     fmt.Sprintf("Cannot read response body: %s", err.Error()),
		}, err
	}

	headers := make(map[string]string)
	for key := range response.Header {
		headers[key] = response.Header.Get(key)
	}

	return Response{
		Timestamp: start.UTC().UnixMilli(),
		Status:    response.StatusCode,
		Headers:   headers,
		Timing:    timing,
		Latency:   latency,
		Body:      string(body),
	}, nil

}
