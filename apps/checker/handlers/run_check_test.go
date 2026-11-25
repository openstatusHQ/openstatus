package handlers_test

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/handlers"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func failingTinybird(t *testing.T) tinybird.Client {
	t.Helper()
	hclient := &http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusInternalServerError,
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}
	})}
	return tinybird.NewClient(hclient, "apiKey")
}

func TestRunTCPCheck_InvalidWorkspaceIsPermanent(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Region: "local"}

	_, err := h.RunTCPCheck(context.Background(), request.TCPCheckerRequest{WorkspaceID: "abc", MonitorID: "1"})

	var invalid handlers.InvalidRequestError
	assert.True(t, errors.As(err, &invalid))
}

func TestRunTCPCheck_ReportsRecordFailure(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { ln.Close() })

	h := handlers.Handler{TbClient: failingTinybird(t), Region: "local"}

	_, err = h.RunTCPCheck(context.Background(), request.TCPCheckerRequest{
		URI:         ln.Addr().String(),
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "active",
		Timeout:     5,
		Retry:       1,
	})

	require.Error(t, err)
	var invalid handlers.InvalidRequestError
	assert.False(t, errors.As(err, &invalid))
}

func TestRunTCPCheck_RecordedFailureIsNotAnError(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	addr := ln.Addr().String()
	ln.Close()

	h := handlers.Handler{TbClient: testTinybird(t), Region: "local"}

	res, err := h.RunTCPCheck(context.Background(), request.TCPCheckerRequest{
		URI:         addr,
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "error",
		Timeout:     5,
		Retry:       1,
	})

	assert.NoError(t, err)
	assert.Equal(t, uint8(1), res.Error)
}

func TestRunCheck_InvalidIDsArePermanent(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Region: "local"}
	ctx := context.Background()

	tests := []struct {
		name   string
		run    func(workspaceID, monitorID string) error
		reason map[string]string
	}{
		{
			name: "dns",
			run: func(w, m string) error {
				_, err := h.RunDNSCheck(ctx, request.DNSCheckerRequest{WorkspaceID: w, MonitorID: m})
				return err
			},
			reason: map[string]string{"workspace": "invalid workspace id", "monitor": "invalid monitor id"},
		},
		{
			name: "icmp",
			run: func(w, m string) error {
				_, err := h.RunICMPCheck(ctx, request.ICMPCheckerRequest{WorkspaceID: w, MonitorID: m})
				return err
			},
			reason: map[string]string{"workspace": "invalid request", "monitor": "invalid request"},
		},
		{
			name: "grpc",
			run: func(w, m string) error {
				_, err := h.RunGRPCCheck(ctx, request.GRPCCheckerRequest{WorkspaceID: w, MonitorID: m})
				return err
			},
			reason: map[string]string{"workspace": "invalid request", "monitor": "invalid request"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name+"/workspace", func(t *testing.T) {
			var invalid handlers.InvalidRequestError
			require.True(t, errors.As(tt.run("abc", "1"), &invalid))
			assert.Equal(t, tt.reason["workspace"], invalid.Reason)
		})
		t.Run(tt.name+"/monitor", func(t *testing.T) {
			var invalid handlers.InvalidRequestError
			require.True(t, errors.As(tt.run("1", "abc"), &invalid))
			assert.Equal(t, tt.reason["monitor"], invalid.Reason)
		})
	}
}

func TestRunDNSCheck_ResolverErrorIsRecordedAsFailure(t *testing.T) {
	h := handlers.Handler{TbClient: testTinybird(t), Region: "local"}

	// An empty host fails the lookup without touching the network.
	res, err := h.RunDNSCheck(context.Background(), request.DNSCheckerRequest{
		URI:         "",
		WorkspaceID: "1",
		MonitorID:   "1",
		Status:      "error",
		Timeout:     5,
		Retry:       1,
	})

	assert.NoError(t, err)
	assert.Equal(t, uint8(1), res.Error)
	assert.Equal(t, "error", res.RequestStatus)
	assert.NotEmpty(t, res.ErrorMessage)
}
