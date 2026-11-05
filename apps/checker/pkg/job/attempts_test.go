package job_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

func TestHTTPJob_RecordsAttempts(t *testing.T) {
	tests := []struct {
		name     string
		statuses []int
		retry    int64
		want     int
	}{
		{name: "first try passes", statuses: []int{http.StatusOK}, retry: 2, want: 1},
		{name: "fails then passes", statuses: []int{http.StatusServiceUnavailable, http.StatusOK}, retry: 2, want: 2},
		{name: "every attempt fails", statuses: []int{http.StatusInternalServerError, http.StatusInternalServerError}, retry: 2, want: 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.statuses[calls])
				calls++
			}))
			t.Cleanup(server.Close)

			data, err := job.NewJobRunner().HTTPJob(context.Background(), &v1.HTTPMonitor{
				Url:     server.URL,
				Method:  http.MethodGet,
				Timeout: 1000,
				Retry:   tt.retry,
			}, "test-region")
			require.NoError(t, err)

			assert.Equal(t, tt.want, data.Attempts)
		})
	}
}

func TestTCPJob_RecordsAttemptsWhenEveryAttemptFails(t *testing.T) {
	data, err := job.NewJobRunner().TCPJob(context.Background(), &v1.TCPMonitor{
		Uri:     closedGRPCPort(t),
		Timeout: 50,
		Retry:   2,
	}, "test-region")
	require.NoError(t, err)

	assert.Equal(t, 2, data.Attempts)
}

func TestDNSJob_RecordsAttemptsWhenEveryAttemptFails(t *testing.T) {
	data, err := job.NewJobRunner().DNSJob(context.Background(), &v1.DNSMonitor{
		Uri:     "openstatus-does-not-resolve.invalid",
		Timeout: 5000,
		Retry:   2,
	})
	require.NoError(t, err)

	assert.Equal(t, 2, data.Attempts)
}

func TestGRPCJob_RecordsAttempts(t *testing.T) {
	t.Run("first try passes", func(t *testing.T) {
		target, _ := grpcJobServer(t, grpc_health_v1.HealthCheckResponse_SERVING, 0)

		data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
			Uri:     target,
			TlsMode: "plaintext",
			Timeout: 1000,
			Retry:   2,
		}, "test-region")
		require.NoError(t, err)

		assert.Equal(t, 1, data.Attempts)
	})

	t.Run("every attempt fails", func(t *testing.T) {
		data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
			Uri:     closedGRPCPort(t),
			TlsMode: "plaintext",
			Timeout: 200,
			Retry:   2,
		}, "test-region")
		require.NoError(t, err)

		assert.Equal(t, 2, data.Attempts)
	})
}

func TestICMPJob_RecordsAttemptsWhenEveryAttemptFails(t *testing.T) {
	data, err := job.NewJobRunner().ICMPJob(context.Background(), &v1.ICMPMonitor{
		Uri:     "nonexistent-host-openstatus-test.invalid",
		Timeout: 1000,
		Retry:   2,
	}, "test-region")
	require.NoError(t, err)

	assert.Equal(t, 2, data.Attempts)
}
