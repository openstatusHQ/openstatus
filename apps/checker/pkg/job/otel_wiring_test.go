package job_test

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeOTLP is a fake OTLP endpoint that captures every export body. The OTLP
// HTTP exporter uses no compression by default, so metric names appear verbatim
// in the protobuf payload and can be matched with a substring search.
type fakeOTLP struct {
	server *httptest.Server
	mu     sync.Mutex
	bodies [][]byte
}

func newOTLP(t *testing.T) *fakeOTLP {
	t.Helper()
	f := &fakeOTLP{}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		f.mu.Lock()
		f.bodies = append(f.bodies, body)
		f.mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(f.server.Close)
	return f
}

func (f *fakeOTLP) sawMetric(name string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, b := range f.bodies {
		if bytes.Contains(b, []byte(name)) {
			return true
		}
	}
	return false
}

func (f *fakeOTLP) requireMetric(t *testing.T, name string) {
	t.Helper()
	require.Eventually(t, func() bool {
		return f.sawMetric(name)
	}, 3*time.Second, 20*time.Millisecond, "expected an OTLP export containing %q", name)
}

func targetServer(t *testing.T, status int) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(status)
	}))
	t.Cleanup(server.Close)
	return server
}

func TestHTTPJob_RecordsOTelMetrics(t *testing.T) {
	target := targetServer(t, http.StatusOK)
	otlp := newOTLP(t)

	monitor := &v1.HTTPMonitor{
		Url:        target.URL,
		Method:     "GET",
		Timeout:    10000,
		Retry:      1,
		OtelConfig: &v1.OtelConfig{Endpoint: otlp.server.URL},
	}

	data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor, "test-region")
	require.NoError(t, err)
	assert.Equal(t, "success", data.RequestStatus)
	otlp.requireMetric(t, "openstatus.status")
}

func TestHTTPJob_RecordsErrorOnNon2xx(t *testing.T) {
	target := targetServer(t, http.StatusInternalServerError)
	otlp := newOTLP(t)

	monitor := &v1.HTTPMonitor{
		Url:        target.URL,
		Method:     "GET",
		Timeout:    10000,
		Retry:      2,
		OtelConfig: &v1.OtelConfig{Endpoint: otlp.server.URL},
	}

	data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor, "test-region")
	require.NoError(t, err)
	assert.Equal(t, uint8(1), data.Error)
	otlp.requireMetric(t, "openstatus.error")
	assert.False(t, otlp.sawMetric("openstatus.status"), "a non-2xx must not record the status counter")
}

func TestHTTPJob_RecordsOTelOnFailure(t *testing.T) {
	otlp := newOTLP(t)

	monitor := &v1.HTTPMonitor{
		Url:        "http://127.0.0.1:1",
		Method:     "GET",
		Timeout:    1000,
		Retry:      1,
		OtelConfig: &v1.OtelConfig{Endpoint: otlp.server.URL},
	}

	_, err := job.NewJobRunner().HTTPJob(context.Background(), monitor, "test-region")
	require.Error(t, err)
	otlp.requireMetric(t, "openstatus.error")
}

func TestHTTPJob_NoOTelWhenEndpointEmpty(t *testing.T) {
	target := targetServer(t, http.StatusOK)

	monitor := &v1.HTTPMonitor{
		Url:     target.URL,
		Method:  "GET",
		Timeout: 10000,
		Retry:   1,
	}

	data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor, "test-region")
	require.NoError(t, err)
	assert.Equal(t, "success", data.RequestStatus)
}

func TestTCPJob_RecordsOTelMetrics(t *testing.T) {
	target := targetServer(t, http.StatusOK)
	otlp := newOTLP(t)

	monitor := &v1.TCPMonitor{
		Uri:        strings.TrimPrefix(target.URL, "http://"),
		Timeout:    5,
		Retry:      1,
		OtelConfig: &v1.OtelConfig{Endpoint: otlp.server.URL},
	}

	data, err := job.NewJobRunner().TCPJob(context.Background(), monitor, "test-region")
	require.NoError(t, err)
	assert.Equal(t, "active", data.RequestStatus)
	otlp.requireMetric(t, "openstatus.status")
}

func TestTCPJob_RecordsOTelOnFailure(t *testing.T) {
	otlp := newOTLP(t)

	monitor := &v1.TCPMonitor{
		Uri:        "127.0.0.1:1",
		Timeout:    1,
		Retry:      1,
		OtelConfig: &v1.OtelConfig{Endpoint: otlp.server.URL},
	}

	data, err := job.NewJobRunner().TCPJob(context.Background(), monitor, "test-region")
	require.NoError(t, err)
	assert.Equal(t, 1, data.Error)
	otlp.requireMetric(t, "openstatus.error")
}
