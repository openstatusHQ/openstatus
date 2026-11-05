package handlers_test

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

type recordedRow struct {
	ID      string `json:"id"`
	Message string `json:"message"`
}

func lastRow(t *testing.T, sent [][]byte) recordedRow {
	t.Helper()
	require.NotEmpty(t, sent)

	var row recordedRow
	require.NoError(t, json.Unmarshal(sent[len(sent)-1], &row))

	return row
}

func TestRunHTTPCheck_SameRequestIDOnEveryAttempt(t *testing.T) {
	tests := []struct {
		name     string
		statuses []int
		status   string
	}{
		{name: "fails then passes", statuses: []int{http.StatusServiceUnavailable, http.StatusOK}, status: "active"},
		{name: "every attempt fails", statuses: []int{http.StatusInternalServerError, http.StatusInternalServerError}, status: "error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var seen []string
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				seen = append(seen, r.Header.Get(request.RequestIDHeader))
				w.WriteHeader(tt.statuses[len(seen)-1])
			}))
			t.Cleanup(server.Close)

			var sent [][]byte
			h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}

			_, err := h.RunHTTPCheck(context.Background(), request.HttpCheckerRequest{
				URL:         server.URL,
				Method:      http.MethodGet,
				WorkspaceID: "1",
				MonitorID:   "1",
				Status:      tt.status,
				Timeout:     1000,
				Retry:       2,
			})
			require.NoError(t, err)

			require.Len(t, seen, 2)
			require.NotEmpty(t, seen[0])
			assert.Equal(t, seen[0], seen[1])
			assert.Equal(t, seen[0], lastRow(t, sent).ID)
		})
	}
}

// checker.Http reports a failed client.Do as a response, so a dropped connection
// is recorded by the last attempt. Only a failed body read reaches the all-failed
// fallback row after the request was sent. The message shows which path ran.
func TestRunHTTPCheck_TransportFailureKeepsRequestID(t *testing.T) {
	tests := []struct {
		name    string
		respond func(t *testing.T, w http.ResponseWriter)
		message string
	}{
		{
			name: "connection closed before a response records the last attempt",
			respond: func(t *testing.T, w http.ResponseWriter) {
				conn, _, err := w.(http.Hijacker).Hijack()
				if assert.NoError(t, err) {
					assert.NoError(t, conn.Close())
				}
			},
			message: "Connection closed by server",
		},
		{
			name: "body cut short records the fallback row",
			respond: func(t *testing.T, w http.ResponseWriter) {
				w.Header().Set("Content-Length", "10")
				_, err := w.Write([]byte("short"))
				assert.NoError(t, err)
			},
			message: "unable to ping",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var mu sync.Mutex
			var seen []string
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				mu.Lock()
				seen = append(seen, r.Header.Get(request.RequestIDHeader))
				mu.Unlock()
				tt.respond(t, w)
			}))
			t.Cleanup(server.Close)

			var sent [][]byte
			h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}

			_, err := h.RunHTTPCheck(context.Background(), request.HttpCheckerRequest{
				URL:         server.URL,
				Method:      http.MethodGet,
				WorkspaceID: "1",
				MonitorID:   "1",
				Status:      "error",
				Timeout:     1000,
				Retry:       2,
			})
			require.NoError(t, err)

			mu.Lock()
			defer mu.Unlock()

			require.Len(t, seen, 2)
			require.NotEmpty(t, seen[0])
			assert.Equal(t, seen[0], seen[1])

			require.Len(t, sent, 1)
			row := lastRow(t, sent)
			assert.Equal(t, seen[0], row.ID)
			assert.Contains(t, row.Message, tt.message)
		})
	}
}

func TestRunHTTPCheck_FallbackRowHasID(t *testing.T) {
	var sent [][]byte
	h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}

	_, err := h.RunHTTPCheck(context.Background(), request.HttpCheckerRequest{
		URL:         "https://openstat.us",
		Method:      "BAD METHOD",
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "error",
		Timeout:     1000,
		Retry:       1,
	})
	require.NoError(t, err)

	assert.NotEmpty(t, lastRow(t, sent).ID)
}

func grpcMetadataServer(t *testing.T, seen *[]string, failures int) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	server := grpc.NewServer(grpc.UnaryInterceptor(
		func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
			md, _ := metadata.FromIncomingContext(ctx)
			*seen = append(*seen, md.Get(request.RequestIDHeader)...)
			if len(*seen) <= failures {
				return nil, status.Error(codes.Unavailable, "unavailable")
			}
			return handler(ctx, req)
		},
	))
	healthServer := health.NewServer()
	healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)
	grpc_health_v1.RegisterHealthServer(server, healthServer)

	go func() {
		_ = server.Serve(listener)
	}()
	t.Cleanup(server.Stop)

	return listener.Addr().String()
}

func TestRunGRPCCheck_SameRequestIDOnEveryAttempt(t *testing.T) {
	tests := []struct {
		name     string
		failures int
		status   string
	}{
		{name: "fails then passes", failures: 1, status: "active"},
		{name: "every attempt fails records the fallback row", failures: 2, status: "error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var seen []string
			target := grpcMetadataServer(t, &seen, tt.failures)

			var sent [][]byte
			h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}
			headers := map[string]string{"custom": "value"}

			_, err := h.RunGRPCCheck(context.Background(), request.GRPCCheckerRequest{
				URI:         target,
				TLS:         "plaintext",
				WorkspaceID: "1",
				MonitorID:   "1",
				Status:      tt.status,
				Timeout:     1000,
				Retry:       2,
				Headers:     headers,
			})
			require.NoError(t, err)

			require.Len(t, seen, 2)
			require.NotEmpty(t, seen[0])
			assert.Equal(t, seen[0], seen[1])
			assert.Equal(t, seen[0], lastRow(t, sent).ID)
			assert.Equal(t, map[string]string{"custom": "value"}, headers)
		})
	}
}
