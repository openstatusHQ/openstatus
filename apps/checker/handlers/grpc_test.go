package handlers_test

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker/handlers"
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
