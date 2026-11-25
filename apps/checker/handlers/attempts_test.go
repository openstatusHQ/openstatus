package handlers_test

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

type attemptsRow struct {
	Attempts      int   `json:"attempts"`
	Timestamp     int64 `json:"timestamp"`
	CronTimestamp int64 `json:"cronTimestamp"`
}

func singleAttemptsRow(t *testing.T, sent [][]byte) attemptsRow {
	t.Helper()
	require.Len(t, sent, 1)

	var row attemptsRow
	require.NoError(t, json.Unmarshal(sent[0], &row))

	return row
}

func closedTCPAddr(t *testing.T) string {
	t.Helper()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	addr := ln.Addr().String()
	require.NoError(t, ln.Close())

	return addr
}

func TestRunHTTPCheck_RecordsAttempts(t *testing.T) {
	tests := []struct {
		name     string
		statuses []int
		retry    int64
		status   string
		want     int
	}{
		{name: "first try passes", statuses: []int{http.StatusOK}, retry: 2, status: "active", want: 1},
		{name: "fails then passes", statuses: []int{http.StatusServiceUnavailable, http.StatusOK}, retry: 2, status: "active", want: 2},
		{
			name:     "every attempt fails",
			statuses: []int{http.StatusInternalServerError, http.StatusInternalServerError, http.StatusInternalServerError},
			retry:    3,
			status:   "error",
			want:     3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.statuses[calls])
				calls++
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
				Retry:       tt.retry,
			})
			require.NoError(t, err)

			assert.Equal(t, tt.want, singleAttemptsRow(t, sent).Attempts)
		})
	}
}

func TestRunTCPCheck_AllFailedRowIsVisible(t *testing.T) {
	var sent [][]byte
	h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}

	_, err := h.RunTCPCheck(context.Background(), request.TCPCheckerRequest{
		URI:           closedTCPAddr(t),
		WorkspaceID:   "1",
		MonitorID:     "1",
		Status:        "error",
		Timeout:       50,
		Retry:         2,
		CronTimestamp: 1234567800,
	})
	require.NoError(t, err)

	row := singleAttemptsRow(t, sent)
	assert.Equal(t, 2, row.Attempts)
	assert.NotZero(t, row.Timestamp)
	assert.Equal(t, int64(1234567800), row.CronTimestamp)
}

func TestRunTCPCheck_RecordsAttemptsOnSuccess(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { ln.Close() })

	var sent [][]byte
	h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}

	_, err = h.RunTCPCheck(context.Background(), request.TCPCheckerRequest{
		URI:         ln.Addr().String(),
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "active",
		Timeout:     50,
		Retry:       2,
	})
	require.NoError(t, err)

	assert.Equal(t, 1, singleAttemptsRow(t, sent).Attempts)
}

func TestRunDNSCheck_RecordsAttempts(t *testing.T) {
	var sent [][]byte
	h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}

	_, err := h.RunDNSCheck(context.Background(), request.DNSCheckerRequest{
		URI:         "openstatus-does-not-resolve.invalid",
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "error",
		Timeout:     1000,
		Retry:       2,
	})
	require.NoError(t, err)

	assert.Equal(t, 2, singleAttemptsRow(t, sent).Attempts)
}

func TestRunGRPCCheck_RecordsAttempts(t *testing.T) {
	tests := []struct {
		name     string
		failures int
		retry    int64
		status   string
		want     int
	}{
		{name: "first try passes", failures: 0, retry: 2, status: "active", want: 1},
		{name: "fails then passes", failures: 1, retry: 2, status: "active", want: 2},
		{name: "every attempt fails", failures: 2, retry: 2, status: "error", want: 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var seen []string
			target := grpcMetadataServer(t, &seen, tt.failures)

			var sent [][]byte
			h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}

			_, err := h.RunGRPCCheck(context.Background(), request.GRPCCheckerRequest{
				URI:         target,
				TLS:         "plaintext",
				WorkspaceID: "1",
				MonitorID:   "1",
				Status:      tt.status,
				Timeout:     1000,
				Retry:       tt.retry,
			})
			require.NoError(t, err)

			assert.Equal(t, tt.want, singleAttemptsRow(t, sent).Attempts)
		})
	}
}

func TestRunICMPCheck_RecordsAttemptsWhenEveryAttemptFails(t *testing.T) {
	var sent [][]byte
	h := handlers.Handler{TbClient: capturingTinybird(t, &sent), Region: "local"}

	_, err := h.RunICMPCheck(context.Background(), request.ICMPCheckerRequest{
		URI:         "nonexistent-host-openstatus-test.invalid",
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "error",
		Timeout:     1000,
		Retry:       2,
	})
	require.NoError(t, err)

	assert.Equal(t, 2, singleAttemptsRow(t, sent).Attempts)
}
