package job_test

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

func closedAddr(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	addr := listener.Addr().String()
	require.NoError(t, listener.Close())

	return addr
}

func TestHTTPJob_CollectsFailedAttempts(t *testing.T) {
	var calls atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)

			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer target.Close()

	data, err := job.NewJobRunner().HTTPJob(context.Background(), &v1.HTTPMonitor{
		Url: target.URL, Method: http.MethodGet, Timeout: 5000, Retry: 3,
	}, "test-region")
	require.NoError(t, err)

	assert.Equal(t, "success", data.RequestStatus)
	require.Len(t, data.Attempts, 1)
	assert.Equal(t, http.StatusServiceUnavailable, data.Attempts[0].StatusCode)
	assert.EqualValues(t, 1, data.Attempts[0].Error)
	assert.NotEqual(t, data.ID, data.Attempts[0].ID)
}

func TestHTTPJob_FinalCheckerErrorIsReported(t *testing.T) {
	data, err := job.NewJobRunner().HTTPJob(context.Background(), &v1.HTTPMonitor{
		Url: "http://" + closedAddr(t), Method: "BAD METHOD", Timeout: 1000, Retry: 2,
	}, "test-region")
	require.NoError(t, err, "a check checker.Http could not run must still be ingested")

	assert.EqualValues(t, 1, data.Error)
	assert.Equal(t, "error", data.RequestStatus)
	assert.Contains(t, data.Message, "unable to ping")
	assert.Positive(t, data.Timestamp)
	require.Len(t, data.Attempts, 1)
	assert.EqualValues(t, 1, data.Attempts[0].Error)
}

func TestTCPJob_CollectsFailedAttempts(t *testing.T) {
	data, err := job.NewJobRunner().TCPJob(context.Background(), &v1.TCPMonitor{
		Uri: closedAddr(t), Timeout: 1000, Retry: 2,
	}, "test-region")
	require.NoError(t, err)

	assert.EqualValues(t, 1, data.Error)
	require.Len(t, data.Attempts, 1)
	assert.EqualValues(t, 1, data.Attempts[0].Error)
	assert.NotEqual(t, data.ID, data.Attempts[0].ID)
}

func TestGRPCJob_CollectsFailedAttempts(t *testing.T) {
	data, err := job.NewJobRunner().GRPCJob(context.Background(), &v1.GRPCMonitor{
		Uri: closedAddr(t), TlsMode: "plaintext", Timeout: 500, Retry: 2,
	}, "test-region")
	require.NoError(t, err)

	assert.EqualValues(t, 1, data.Error)
	require.Len(t, data.Attempts, 1)
	assert.EqualValues(t, 1, data.Attempts[0].Error)
	assert.NotEmpty(t, data.Attempts[0].Timing)
}

func TestDNSJob_BudgetExpiryDoesNotRepeatTheFinalFailure(t *testing.T) {
	data, err := job.NewJobRunner().DNSJob(context.Background(), &v1.DNSMonitor{
		Uri: "attempts.invalid", Timeout: 1, Retry: 3,
	})
	require.NoError(t, err)

	assert.EqualValues(t, 1, data.Error)
	for _, attempt := range data.Attempts {
		assert.NotEqual(t, data.ID, attempt.ID)
	}
}
