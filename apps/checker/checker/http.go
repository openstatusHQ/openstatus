package checker

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"strings"
	"syscall"
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

// maxResponseBodyBytes caps the read of a probed response body so a large body
// cannot OOM the 512 MB checker machines (exit 137 waves).
const maxResponseBodyBytes = 10 << 20 // 10 MiB

// decodeBase64Body decodes a data URL base64 body if needed
func decodeBase64Body(body string) ([]byte, error) {
	data := strings.Split(body, ",")
	if len(data) == 2 {
		return base64.StdEncoding.DecodeString(data[1])
	}
	return nil, fmt.Errorf("invalid base64 data url format")
}

// NewHTTPClient returns a client with a transport of its own. Leaving Transport
// nil shares http.DefaultTransport: a probe could then be handed a pooled
// connection (no DNS/connect/TLS timing), and CloseIdleConnections would tear
// down the connections of every concurrent probe and of the Tinybird client.
func NewHTTPClient(timeout time.Duration, followRedirects bool) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DisableKeepAlives = true
	// The default transport caps dial at 30s and the TLS handshake at 10s,
	// which cut a check short of the monitor's own timeout.
	transport.DialContext = (&net.Dialer{Timeout: timeout}).DialContext
	transport.TLSHandshakeTimeout = timeout

	client := &http.Client{
		Timeout:   timeout,
		Transport: transport,
	}

	if !followRedirects {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	} else {
		// Explicitly limit the number of redirects to 10 (Go's default)
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}

			return nil
		}
	}

	return client
}

// httpErrorMessage turns a failed request into the message stored for the
// customer. The raw error is prefixed with the method and URL, and DNS failures
// name fly's internal resolver ([fdaa::3]:53).
func httpErrorMessage(err error, latency int64) string {
	var urlErr *url.Error
	if errors.As(err, &urlErr) && urlErr.Timeout() {
		return fmt.Sprintf("Timeout after %d ms", latency)
	}

	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return fmt.Sprintf("DNS lookup failed for %s: %s", dnsErr.Name, dnsErr.Err)
	}

	var certErr *tls.CertificateVerificationError
	if errors.As(err, &certErr) {
		return fmt.Sprintf("TLS certificate verification failed: %s", certErr.Err)
	}

	var opErr *net.OpError
	if errors.As(err, &opErr) && opErr.Op == "remote error" {
		return fmt.Sprintf("TLS handshake failed: %s", opErr.Err)
	}

	switch {
	case errors.Is(err, syscall.ECONNREFUSED):
		return "Connection refused"
	case errors.Is(err, syscall.ECONNRESET):
		return "Connection reset by peer"
	case errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF):
		return "Connection closed by server before a response was received"
	}

	if urlErr != nil {
		return urlErr.Err.Error()
	}

	return err.Error()
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
		errorMsg := httpErrorMessage(err, latency)

		// A failing customer endpoint is expected, not a checker error.
		logger.Warn().Err(err).Msg("error while pinging")

		// Return Response with error field instead of returning a Go error
		// This ensures all failures (timeouts, connection refused, DNS failures, etc.)
		// are properly ingested and displayed in the dashboard
		return Response{
			Latency:   latency,
			Timing:    timing,
			Timestamp: start.UTC().UnixMilli(),
			Error:     errorMsg,
			Status:    0,
		}, nil
	}

	defer response.Body.Close()

	// Cap the response body: an endpoint returning a large body would
	// otherwise OOM these 512 MB machines (fleet-wide exit 137 waves).
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBodyBytes))

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
