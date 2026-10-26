package server_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
	"github.com/stretchr/testify/require"
)

type eventsRequest struct {
	dataSource string
	lines      []string
}

type fakeEventsAPI struct {
	mu         sync.Mutex
	requests   []eventsRequest
	statusCode int
}

func (f *fakeEventsAPI) client() *http.Client {
	return (&interceptorHTTPClient{f: func(req *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(req.Body)
		f.mu.Lock()
		f.requests = append(f.requests, eventsRequest{
			dataSource: req.URL.Query().Get("name"),
			lines:      strings.Split(strings.TrimSuffix(string(body), "\n"), "\n"),
		})
		f.mu.Unlock()

		statusCode := f.statusCode
		if statusCode == 0 {
			statusCode = http.StatusAccepted
		}

		return &http.Response{StatusCode: statusCode, Body: io.NopCloser(strings.NewReader(""))}, nil
	}}).GetHTTPClient()
}

func (f *fakeEventsAPI) recorded() []eventsRequest {
	f.mu.Lock()
	defer f.mu.Unlock()

	return append([]eventsRequest(nil), f.requests...)
}

func newBatcher(t *testing.T, api *fakeEventsAPI) *tinybird.Batcher {
	t.Helper()
	b := tinybird.NewBatcher(api.client(), "apiKey", tinybird.BatcherOptions{
		FlushInterval: 50 * time.Millisecond,
		MaxBytes:      1 << 20,
		RetryBudget:   time.Second,
	})
	t.Cleanup(func() { _ = b.Close(context.Background()) })

	return b
}

type httpIngester interface {
	IngestHTTP(context.Context, *connect.Request[private_locationv1.IngestHTTPRequest]) (*connect.Response[private_locationv1.IngestHTTPResponse], error)
}

func ingestHTTP(h httpIngester, id string) error {
	req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
		Id:        id,
		MonitorId: "5",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")
	_, err := h.IngestHTTP(context.Background(), req)

	return err
}

func TestIngest_Batched(t *testing.T) {
	t.Run("it should send concurrent ingests as one NDJSON request", func(t *testing.T) {
		api := &fakeEventsAPI{}
		h := server.NewPrivateLocationServer(testDB(), newBatcher(t, api))

		const n = 10
		errs := make([]error, n)
		var wg sync.WaitGroup
		for i := range n {
			wg.Go(func() { errs[i] = ingestHTTP(h, fmt.Sprintf("check-%d", i)) })
		}
		wg.Wait()
		for _, err := range errs {
			require.NoError(t, err)
		}

		requests := api.recorded()
		require.Len(t, requests, 1)
		require.Equal(t, tinybird.DatasourceHTTP, requests[0].dataSource)
		require.Len(t, requests[0].lines, n)

		ids := make([]string, 0, n)
		for _, line := range requests[0].lines {
			var row server.PingData
			require.NoError(t, json.Unmarshal([]byte(line), &row))
			require.Equal(t, "5", row.MonitorID)
			ids = append(ids, row.ID)
		}
		want := make([]string, 0, n)
		for i := range n {
			want = append(want, fmt.Sprintf("check-%d", i))
		}
		require.ElementsMatch(t, want, ids)
	})

	t.Run("it should batch each data source separately", func(t *testing.T) {
		api := &fakeEventsAPI{}
		h := server.NewPrivateLocationServer(testDB(), newBatcher(t, api))

		var httpErr, tcpErr error
		var wg sync.WaitGroup
		wg.Go(func() { httpErr = ingestHTTP(h, "http-check") })
		wg.Go(func() {
			req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
				Id:        "tcp-check",
				MonitorId: "6",
				Timestamp: 1234567890,
			})
			req.Header().Set("openstatus-token", "my-secret-key")
			_, tcpErr = h.IngestTCP(context.Background(), req)
		})
		wg.Wait()
		require.NoError(t, httpErr)
		require.NoError(t, tcpErr)

		requests := api.recorded()
		require.Len(t, requests, 2)
		require.ElementsMatch(t,
			[]string{tinybird.DatasourceHTTP, tinybird.DatasourceTCP},
			[]string{requests[0].dataSource, requests[1].dataSource},
		)
		for _, r := range requests {
			require.Len(t, r.lines, 1)
		}
	})

	t.Run("it should still ack the ingest and record last_seen_at when the flush fails", func(t *testing.T) {
		api := &fakeEventsAPI{statusCode: http.StatusBadRequest}
		db := testDB()
		h := server.NewPrivateLocationServer(db, newBatcher(t, api))

		require.NoError(t, ingestHTTP(h, "check-rejected"))
		require.Len(t, api.recorded(), 1)

		var lastSeen sql.NullInt64
		require.NoError(t, db.Get(&lastSeen, "SELECT last_seen_at FROM private_location WHERE token = ?", "my-secret-key"))
		require.True(t, lastSeen.Valid)
	})

	t.Run("it should return once the request context ends, before the batch flushes", func(t *testing.T) {
		api := &fakeEventsAPI{}
		b := tinybird.NewBatcher(api.client(), "apiKey", tinybird.BatcherOptions{
			FlushInterval: time.Hour,
			MaxBytes:      1 << 20,
			RetryBudget:   time.Second,
		})
		h := server.NewPrivateLocationServer(testDB(), b)

		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer cancel()
		req := connect.NewRequest(&private_locationv1.IngestHTTPRequest{
			Id:        "check-cancelled",
			MonitorId: "5",
			Timestamp: 1234567890,
		})
		req.Header().Set("openstatus-token", "my-secret-key")

		start := time.Now()
		_, err := h.IngestHTTP(ctx, req)
		require.NoError(t, err)
		require.Less(t, time.Since(start), time.Second)
		require.Empty(t, api.recorded())

		// The abandoned row is still delivered on shutdown.
		require.NoError(t, b.Close(context.Background()))
		requests := api.recorded()
		require.Len(t, requests, 1)
		require.Len(t, requests[0].lines, 1)
	})
}
