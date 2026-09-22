package handlers_test

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// grpcTestServer starts a plaintext health server and returns its host:port.
func grpcTestServer(t *testing.T, status grpc_health_v1.HealthCheckResponse_ServingStatus) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	server := grpc.NewServer()
	healthServer := health.NewServer()
	healthServer.SetServingStatus("", status)
	grpc_health_v1.RegisterHealthServer(server, healthServer)

	go func() {
		_ = server.Serve(listener)
	}()
	t.Cleanup(server.Stop)

	return listener.Addr().String()
}

func TestGRPCHandler_RejectsUnauthorized(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/grpc", h.GRPCHandler)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/grpc", strings.NewReader(`{"uri":"127.0.0.1:1"}`))
	r.Header.Set("Authorization", "Basic wrong")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestGRPCHandler_RejectsBadPayload(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/grpc", h.GRPCHandler)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/grpc", strings.NewReader(`{not json`))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGRPCHandlerRegion_RejectsUnauthorized(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/grpc/:region", h.GRPCHandlerRegion)

	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/grpc/local", strings.NewReader(`{"uri":"127.0.0.1:1"}`))
	r.Header.Set("Authorization", "Basic wrong")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestGRPCHandler_ServingResponse(t *testing.T) {
	target := grpcTestServer(t, grpc_health_v1.HealthCheckResponse_SERVING)

	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/grpc", h.GRPCHandler)

	body := `{"uri":"` + target + `","tls":"plaintext","timeout":5000,"retry":1,"status":"active","workspaceId":"1","monitorId":"1"}`
	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/grpc?data=true", strings.NewReader(body))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var res map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &res))

	assert.Equal(t, "grpc", res["jobType"])
	assert.Equal(t, "local", res["region"])
	assert.Equal(t, "SERVING", res["servingStatus"])
	assert.Equal(t, true, res["completed"])
	assert.NotContains(t, res, "error")
}

// A NOT_SERVING answer is a failed check that completed. It must keep its
// serving status and its measured timing, and must not be retried.
func TestGRPCHandler_NotServingResponse(t *testing.T) {
	target := grpcTestServer(t, grpc_health_v1.HealthCheckResponse_NOT_SERVING)

	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/grpc", h.GRPCHandler)

	body := `{"uri":"` + target + `","tls":"plaintext","timeout":5000,"retry":1,"status":"error","workspaceId":"1","monitorId":"1"}`
	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/grpc?data=true", strings.NewReader(body))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var res map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &res))

	assert.Equal(t, "grpc", res["jobType"])
	assert.Equal(t, "NOT_SERVING", res["servingStatus"])
	assert.Equal(t, true, res["completed"])
	assert.Equal(t, float64(1), res["error"])
	assert.Equal(t, "service reports NOT_SERVING", res["errorMessage"])
}

// A check that exhausts its retries is still returned under `?data=true`, so it
// has to carry the same identifying fields as a successful one — the success
// path sets them inside op(), which never runs when every attempt fails.
func TestGRPCHandler_FailureResponseKeepsJobTypeAndRegion(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	closed := listener.Addr().String()
	require.NoError(t, listener.Close())

	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/grpc", h.GRPCHandler)

	body := `{"uri":"` + closed + `","tls":"plaintext","timeout":500,"retry":1,"status":"error","workspaceId":"1","monitorId":"1"}`
	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/grpc?data=true", strings.NewReader(body))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var res map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &res))

	assert.Equal(t, "grpc", res["jobType"], "jobType is the discriminator callers match on")
	assert.Equal(t, "local", res["region"])
	assert.Equal(t, float64(1), res["error"])
	assert.Equal(t, false, res["completed"])

	// A failed check is when the phase breakdown matters most: it is what
	// separates "DNS never resolved" from "connected, TLS refused".
	timing, ok := res["timing"].(map[string]any)
	require.True(t, ok, "timing must be present on the failure response")
	assert.Greater(t, timing["dnsStart"], float64(0), "resolution was attempted")
	assert.Greater(t, timing["dnsDone"], float64(0), "127.0.0.1 resolves")
	assert.Greater(t, timing["connectStart"], float64(0), "the dial was attempted")
	assert.Equal(t, float64(0), timing["connectDone"], "the port is closed, so connect never completed")

	// OK(0) on a check that never reached the server would make a refused
	// connection indistinguishable from a timeout.
	assert.NotZero(t, res["grpcCode"], "a transport failure carries its status code, not OK")
}

// capturingTinybird records the payloads the handler ships, so a test can
// assert on the ingested row rather than only the HTTP response.
func capturingTinybird(t *testing.T, sent *[][]byte) tinybird.Client {
	t.Helper()
	hclient := &http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		if req.Body != nil {
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			*sent = append(*sent, body)
		}

		return &http.Response{
			StatusCode: http.StatusAccepted,
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}
	})}

	return tinybird.NewClient(hclient, "apiKey")
}

func TestGRPCHandler_FailureEventCarriesTiming(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	closed := listener.Addr().String()
	require.NoError(t, listener.Close())

	var sent [][]byte
	h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/checker/grpc", h.GRPCHandler)

	body := `{"uri":"` + closed + `","tls":"plaintext","timeout":500,"retry":1,"status":"error","workspaceId":"1","monitorId":"1"}`
	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/grpc", strings.NewReader(body))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	require.Len(t, sent, 1, "the exhausted-retries path ships exactly one row")

	var event struct {
		Timing        string `json:"timing"`
		RequestStatus string `json:"requestStatus"`
		GRPCCode      int64  `json:"grpcCode"`
	}
	require.NoError(t, json.Unmarshal(sent[0], &event))
	assert.Equal(t, "error", event.RequestStatus)
	assert.NotZero(t, event.GRPCCode, "a transport failure carries its status code, not OK")

	var timing checker.Timing
	require.NoError(t, json.Unmarshal([]byte(event.Timing), &timing))
	assert.Greater(t, timing.DnsStart, int64(0), "resolution was attempted")
	assert.Greater(t, timing.ConnectStart, int64(0), "the dial was attempted")
	assert.Zero(t, timing.ConnectDone, "the port is closed, so connect never completed")
}

func TestGRPCHandlerRegion_ReturnsResult(t *testing.T) {
	target := grpcTestServer(t, grpc_health_v1.HealthCheckResponse_SERVING)

	h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
	router := gin.New()
	router.POST("/grpc/:region", h.GRPCHandlerRegion)

	body := `{"uri":"` + target + `","tls":"plaintext","timeout":5000}`
	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/grpc/local", strings.NewReader(body))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var res map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &res))

	assert.Equal(t, "grpc", res["jobType"])
	assert.Equal(t, "SERVING", res["servingStatus"])
}

// `retry` counts attempts, not extra tries on top of the first: v5's
// WithMaxTries(n) runs op exactly n times, so the cron/API path and the
// private-location path in pkg/job probe a monitor the same number of times.
// Counting accepted connections is exact here because every attempt builds a
// fresh client, and a connection closed mid-handshake leaves grpc-go nothing
// to reuse.
func TestGRPCHandler_ProbesExactlyRetryTimes(t *testing.T) {
	for _, retry := range []int{1, 2, 3} {
		t.Run("retry="+strconv.Itoa(retry), func(t *testing.T) {
			var accepts int64
			ln, err := net.Listen("tcp", "127.0.0.1:0")
			require.NoError(t, err)

			done := make(chan struct{})
			go func() {
				defer close(done)
				for {
					conn, err := ln.Accept()
					if err != nil {
						return
					}
					atomic.AddInt64(&accepts, 1)
					conn.Close()
				}
			}()

			h := handlers.Handler{TbClient: testTinybird(t), Secret: "test", Region: "local"}
			router := gin.New()
			router.POST("/checker/grpc", h.GRPCHandler)

			body := `{"uri":"` + ln.Addr().String() + `","tls":"plaintext","timeout":500,"retry":` +
				strconv.Itoa(retry) + `,"status":"error","workspaceId":"1","monitorId":"1"}`
			w := httptest.NewRecorder()
			r, _ := http.NewRequest(http.MethodPost, "/checker/grpc", strings.NewReader(body))
			r.Header.Set("Authorization", "Basic test")
			router.ServeHTTP(w, r)

			require.NoError(t, ln.Close())
			<-done

			assert.Equal(t, int64(retry), atomic.LoadInt64(&accepts),
				"retry:%d must probe %d times", retry, retry)
		})
	}
}

// grpcTestServerNoHealth starts a plaintext gRPC server with no services
// registered, so Health/Check answers UNIMPLEMENTED.
func grpcTestServerNoHealth(t *testing.T) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	server := grpc.NewServer()
	go func() {
		_ = server.Serve(listener)
	}()
	t.Cleanup(server.Stop)

	return listener.Addr().String()
}

// A server that answers UNIMPLEMENTED reached the wire and timed a real round
// trip, so its row must carry a serving status. A NULL one means "never reached
// the server" to the metrics pipes, which would drop it from every latency
// quantile alongside genuine transport failures.
func TestGRPCHandler_UnimplementedRowCarriesServingStatus(t *testing.T) {
	target := grpcTestServerNoHealth(t)

	var sent [][]byte
	h := handlers.Handler{
		TbClient: capturingTinybird(t, &sent),
		Secret:   "test",
		Region:   "local",
	}
	router := gin.New()
	router.POST("/checker/grpc", h.GRPCHandler)

	// status:"error" matches the outcome, so the handler skips its status-change
	// callback and the test makes no outbound request.
	body := `{"uri":"` + target + `","tls":"plaintext","timeout":5000,"retry":1,"status":"error","workspaceId":"1","monitorId":"1"}`
	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, "/checker/grpc?data=true", strings.NewReader(body))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	require.Len(t, sent, 1, "a completed check ships exactly one row")

	var event struct {
		ServingStatus string `json:"servingStatus"`
		RequestStatus string `json:"requestStatus"`
	}
	require.NoError(t, json.Unmarshal(sent[0], &event))
	assert.Equal(t, "UNIMPLEMENTED", event.ServingStatus)
	// Still an unhealthy check — only its visibility to the pipes changed.
	assert.Equal(t, "error", event.RequestStatus)
}
