package handlers_test

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// countingOTLPServer accepts any OTLP export and counts the requests it receives.
func countingOTLPServer(t *testing.T) (*httptest.Server, *int64) {
	t.Helper()
	var count int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		atomic.AddInt64(&count, 1)
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)
	return server, &count
}

func testTinybird(t *testing.T) tinybird.Client {
	t.Helper()
	hclient := &http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusAccepted,
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}
	})}
	return tinybird.NewClient(hclient, "apiKey")
}

func TestTCPHandler_ExportsOTLPOnSuccess(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { ln.Close() })

	otlp, count := countingOTLPServer(t)

	h := handlers.Handler{
		TbClient: testTinybird(t),
		Secret:   "test",
		Region:   "local",
	}
	router := gin.New()
	router.POST("/checker/tcp", h.TCPHandler)

	req := request.TCPCheckerRequest{
		URI:         ln.Addr().String(),
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "active", // avoids the network UpdateStatus call
		Timeout:     5,
		Retry:       1,
	}
	req.OtelConfig.Endpoint = otlp.URL
	body, _ := json.Marshal(req)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/tcp", strings.NewReader(string(body)))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Eventually(t, func() bool { return atomic.LoadInt64(count) > 0 }, 5*time.Second, 50*time.Millisecond,
		"expected an OTLP export on TCP success")
}

func TestTCPHandlerRegion_ExportsOTLPOnFailure(t *testing.T) {
	otlp, count := countingOTLPServer(t)

	h := handlers.Handler{
		TbClient: testTinybird(t),
		Secret:   "test",
		Region:   "local",
	}
	router := gin.New()
	router.POST("/tcp/:region", h.TCPHandlerRegion)

	req := request.TCPCheckerRequest{
		URI:     "127.0.0.1:1", // connection refused
		Status:  "active",
		Timeout: 5,
	}
	req.OtelConfig.Endpoint = otlp.URL
	body, _ := json.Marshal(req)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/tcp/local", strings.NewReader(string(body)))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Eventually(t, func() bool { return atomic.LoadInt64(count) > 0 }, 10*time.Second, 50*time.Millisecond,
		"expected an OTLP export on TCP failure")
}

func TestDNSHandler_ExportsOTLPOnFailure(t *testing.T) {
	otlp, count := countingOTLPServer(t)

	h := handlers.Handler{
		TbClient: testTinybird(t),
		Secret:   "test",
		Region:   "local",
	}
	router := gin.New()
	router.POST("/checker/dns", h.DNSHandler)

	req := request.DNSCheckerRequest{
		URI:         "nonexistent-host-openstatus-test.invalid",
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "error", // resolution failure keeps isSuccessful=true, so no UpdateStatus
		Retry:       1,
	}
	req.OtelConfig.Endpoint = otlp.URL
	body, _ := json.Marshal(req)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/dns", strings.NewReader(string(body)))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Eventually(t, func() bool { return atomic.LoadInt64(count) > 0 }, 10*time.Second, 50*time.Millisecond,
		"expected an OTLP export on DNS failure")
}

func TestDNSHandlerRegion_ExportsOTLPOnFailure(t *testing.T) {
	otlp, count := countingOTLPServer(t)

	h := handlers.Handler{
		TbClient: testTinybird(t),
		Secret:   "test",
		Region:   "local",
	}
	router := gin.New()
	router.POST("/dns/:region", h.DNSHandlerRegion)

	req := request.DNSCheckerRequest{
		URI:         "nonexistent-host-openstatus-test.invalid",
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "error",
		Retry:       1,
	}
	req.OtelConfig.Endpoint = otlp.URL
	body, _ := json.Marshal(req)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/dns/local", strings.NewReader(string(body)))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Eventually(t, func() bool { return atomic.LoadInt64(count) > 0 }, 10*time.Second, 50*time.Millisecond,
		"expected an OTLP export on DNS failure")
}
