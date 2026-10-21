package handlers_test

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
)

type tinybirdRecorder struct {
	mu     sync.Mutex
	events map[string][][]byte
}

func newTinybirdRecorder(t *testing.T) (*tinybirdRecorder, tinybird.Client) {
	t.Helper()
	rec := &tinybirdRecorder{events: map[string][][]byte{}}
	hclient := &http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		rec.mu.Lock()
		name := req.URL.Query().Get("name")
		rec.events[name] = append(rec.events[name], body)
		rec.mu.Unlock()

		return &http.Response{
			StatusCode: http.StatusAccepted,
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}
	})}

	return rec, tinybird.NewClient(hclient, "apiKey")
}

func (r *tinybirdRecorder) decode(t *testing.T, dataSource string) []map[string]any {
	t.Helper()
	r.mu.Lock()
	defer r.mu.Unlock()
	rows := make([]map[string]any, 0, len(r.events[dataSource]))
	for _, body := range r.events[dataSource] {
		var row map[string]any
		require.NoError(t, json.Unmarshal(body, &row))
		rows = append(rows, row)
	}

	return rows
}

func closedAddr(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	addr := listener.Addr().String()
	require.NoError(t, listener.Close())

	return addr
}

func serve(t *testing.T, path string, handler gin.HandlerFunc, body string) {
	t.Helper()
	router := gin.New()
	router.POST(path, handler)
	w := httptest.NewRecorder()
	r, _ := http.NewRequest(http.MethodPost, path, strings.NewReader(body))
	r.Header.Set("Authorization", "Basic test")
	router.ServeHTTP(w, r)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestHTTPCheckerHandler_Attempts(t *testing.T) {
	t.Run("a check that passes on retry stores the failed attempt", func(t *testing.T) {
		var calls atomic.Int32
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			if calls.Add(1) == 1 {
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer target.Close()

		rec, client := newTinybirdRecorder(t)
		h := handlers.Handler{TbClient: client, Secret: "test", Region: "ams"}
		serve(t, "/checker", h.HTTPCheckerHandler, `{"url":"`+target.URL+`","method":"GET","monitorId":"1","workspaceId":"2","cronTimestamp":1000,"status":"active","retry":3,"timeout":5000}`)

		attempts := rec.decode(t, "ping_attempt__v0")
		require.Len(t, attempts, 1)
		assert.EqualValues(t, 1, attempts[0]["attempt"])
		assert.EqualValues(t, http.StatusServiceUnavailable, attempts[0]["statusCode"])
		assert.EqualValues(t, 1, attempts[0]["error"])
		assert.Equal(t, "error", attempts[0]["requestStatus"])
		assert.Equal(t, "ams", attempts[0]["region"])
		assert.EqualValues(t, 1000, attempts[0]["cronTimestamp"])

		final := rec.decode(t, "ping_response__v8")
		require.Len(t, final, 1)
		assert.EqualValues(t, http.StatusOK, final[0]["statusCode"])
		assert.EqualValues(t, 2, final[0]["attempts"])
		assert.NotEqual(t, attempts[0]["id"], final[0]["id"])
	})

	t.Run("the last failed attempt is only written to ping_response", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer target.Close()

		rec, client := newTinybirdRecorder(t)
		h := handlers.Handler{TbClient: client, Secret: "test", Region: "ams"}
		serve(t, "/checker", h.HTTPCheckerHandler, `{"url":"`+target.URL+`","method":"GET","monitorId":"1","workspaceId":"2","cronTimestamp":1000,"status":"error","retry":2,"timeout":5000}`)

		attempts := rec.decode(t, "ping_attempt__v0")
		require.Len(t, attempts, 1)
		assert.EqualValues(t, 1, attempts[0]["attempt"])

		final := rec.decode(t, "ping_response__v8")
		require.Len(t, final, 1)
		assert.EqualValues(t, 2, final[0]["attempts"])
	})

	t.Run("a transport error is stored as an attempt", func(t *testing.T) {
		rec, client := newTinybirdRecorder(t)
		h := handlers.Handler{TbClient: client, Secret: "test", Region: "ams"}
		serve(t, "/checker", h.HTTPCheckerHandler, `{"url":"http://`+closedAddr(t)+`","method":"GET","monitorId":"1","workspaceId":"2","cronTimestamp":1000,"status":"error","retry":2,"timeout":1000}`)

		attempts := rec.decode(t, "ping_attempt__v0")
		require.Len(t, attempts, 1)
		assert.NotEmpty(t, attempts[0]["message"])
		assert.NotZero(t, attempts[0]["timestamp"])

		final := rec.decode(t, "ping_response__v8")
		require.Len(t, final, 1)
		assert.EqualValues(t, 2, final[0]["attempts"])
	})

	t.Run("a check that passes first time stores no attempt", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer target.Close()

		rec, client := newTinybirdRecorder(t)
		h := handlers.Handler{TbClient: client, Secret: "test", Region: "ams"}
		serve(t, "/checker", h.HTTPCheckerHandler, `{"url":"`+target.URL+`","method":"GET","monitorId":"1","workspaceId":"2","status":"active","timeout":5000}`)

		assert.Empty(t, rec.decode(t, "ping_attempt__v0"))
		final := rec.decode(t, "ping_response__v8")
		require.Len(t, final, 1)
		assert.EqualValues(t, 1, final[0]["attempts"])
	})
}

func TestTCPHandler_Attempts(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := handlers.Handler{TbClient: client, Secret: "test", Region: "ams"}
	serve(t, "/checker/tcp", h.TCPHandler, `{"uri":"`+closedAddr(t)+`","monitorId":"1","workspaceId":"2","cronTimestamp":1000,"status":"error","retry":2,"timeout":1000}`)

	attempts := rec.decode(t, "tcp_attempt__v0")
	require.Len(t, attempts, 1)
	assert.EqualValues(t, 1, attempts[0]["attempt"])
	assert.EqualValues(t, 1000, attempts[0]["cronTimestamp"])
	assert.NotZero(t, attempts[0]["timestamp"])

	final := rec.decode(t, "tcp_response__v0")
	require.Len(t, final, 1)
	assert.EqualValues(t, 2, final[0]["attempts"])
	assert.EqualValues(t, 1000, final[0]["cronTimestamp"])
	assert.NotZero(t, final[0]["timestamp"], "tcp_response__v0 partitions on timestamp")
}

func TestGRPCHandler_Attempts(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := handlers.Handler{TbClient: client, Secret: "test", Region: "ams"}
	serve(t, "/checker/grpc", h.GRPCHandler, `{"uri":"`+closedAddr(t)+`","tls":"plaintext","monitorId":"1","workspaceId":"2","cronTimestamp":1000,"status":"error","retry":2,"timeout":500}`)

	attempts := rec.decode(t, "grpc_attempt__v0")
	require.Len(t, attempts, 1)
	assert.EqualValues(t, 1, attempts[0]["attempt"])
	assert.Equal(t, "error", attempts[0]["requestStatus"])
	assert.NotZero(t, attempts[0]["grpcCode"])
	assert.NotEmpty(t, attempts[0]["timing"])

	final := rec.decode(t, "grpc_response__v0")
	require.Len(t, final, 1)
	assert.EqualValues(t, 2, final[0]["attempts"])
}

func TestDNSHandler_Attempts(t *testing.T) {
	rec, client := newTinybirdRecorder(t)
	h := handlers.Handler{TbClient: client, Secret: "test", Region: "ams"}
	serve(t, "/checker/dns", h.DNSHandler, `{"uri":"attempts.invalid","monitorId":"1","workspaceId":"2","cronTimestamp":1000,"status":"active","retry":2,"timeout":1}`)

	attempts := rec.decode(t, "dns_attempt__v0")
	require.Len(t, attempts, 1)
	assert.EqualValues(t, 1, attempts[0]["attempt"])
	assert.EqualValues(t, 1, attempts[0]["error"])
	assert.EqualValues(t, 1000, attempts[0]["cronTimestamp"])
	assert.IsType(t, "", attempts[0]["records"], "records stays a string column")

	final := rec.decode(t, "dns_response__v0")
	require.Len(t, final, 1)
	assert.EqualValues(t, 2, final[0]["attempts"])
	assert.NotEqual(t, attempts[0]["id"], final[0]["id"])
}
