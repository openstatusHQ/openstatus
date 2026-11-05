package job_test

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

func TestHTTPJob_SameRequestIDOnEveryAttempt(t *testing.T) {
	var seen []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.Header.Get(request.RequestIDHeader))
		if len(seen) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	}))
	t.Cleanup(server.Close)

	data, err := job.NewJobRunner().HTTPJob(context.Background(), &v1.HTTPMonitor{
		Url:     server.URL,
		Method:  http.MethodGet,
		Timeout: 1000,
		Retry:   2,
	}, "test-region")
	require.NoError(t, err)

	require.Len(t, seen, 2)
	require.NotEmpty(t, seen[0])
	assert.Equal(t, seen[0], seen[1])
	assert.Equal(t, seen[0], data.ID)
}

func TestGRPCJob_SameRequestIDOnEveryAttempt(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	var seen []string
	server := grpc.NewServer(grpc.UnaryInterceptor(
		func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
			md, _ := metadata.FromIncomingContext(ctx)
			seen = append(seen, md.Get(request.RequestIDHeader)...)
			if len(seen) == 1 {
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

	data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
		Uri:     listener.Addr().String(),
		TlsMode: "plaintext",
		Timeout: 1000,
		Retry:   2,
	}, "test-region")
	require.NoError(t, err)

	require.Len(t, seen, 2)
	require.NotEmpty(t, seen[0])
	assert.Equal(t, seen[0], seen[1])
	assert.Equal(t, seen[0], data.ID)
}
