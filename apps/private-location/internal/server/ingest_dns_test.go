package server_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
	"github.com/openstatushq/openstatus/apps/private-location/internal/workflows"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
	"github.com/stretchr/testify/require"
)

func TestIngestDNS_Unauthenticated(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{})
	// No token header
	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for missing token, got nil")
	}
	if connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("expected unauthenticated code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_ValidationError_EmptyID(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for validation failure, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected invalid argument code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_ValidationError_InvalidTimestamp(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "dns-123",
		MonitorId: "5",
		Timestamp: 0, // Invalid - must be positive
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for validation failure, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected invalid argument code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_ValidationError_NegativeLatency(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "dns-123",
		MonitorId: "5",
		Latency:   -100,
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for validation failure, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected invalid argument code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_DBError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "nonexistent-monitor",
		MonitorId: "nonexistent-monitor",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "invalid-token")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for db failure, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInternal {
		t.Errorf("expected internal code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_MonitorNotExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:        "dns-123",
		MonitorId: "nonexistent-monitor",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for monitor not found, got nil")
	}
	if connect.CodeOf(err) != connect.CodeInternal {
		t.Errorf("expected internal code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestIngestDNS_MonitorExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:            "dns-result-1",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       50,
		CronTimestamp: 1234567800,
		Uri:           "dns://example.com",
		Timing:        "50ms",
		Records:       nil,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}

func TestIngestDNS_WithRecords(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:            "dns-result-2",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       50,
		CronTimestamp: 1234567800,
		Uri:           "dns://example.com",
		Timing:        "50ms",
		Records: map[string]*private_locationv1.Records{
			"A": {
				Record: []string{"192.168.1.1", "192.168.1.2"},
			},
			"AAAA": {
				Record: []string{"::1"},
			},
		},
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}

// TestIngestDNS_RecordsKeyedByType guards against keying the stored records by
// the proto message's String() output instead of the DNS record type.
func TestIngestDNS_RecordsKeyedByType(t *testing.T) {
	var capturedBody []byte
	interceptor := &interceptorHTTPClient{
		f: func(req *http.Request) (*http.Response, error) {
			if req.Body != nil {
				capturedBody, _ = io.ReadAll(req.Body)
			}
			return &http.Response{StatusCode: http.StatusAccepted}, nil
		},
	}
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(interceptor.GetHTTPClient(), "apiKey"))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:            "dns-result-key",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       50,
		CronTimestamp: 1234567800,
		Uri:           "dns://example.com",
		Records: map[string]*private_locationv1.Records{
			"A":    {Record: []string{"192.168.1.1"}},
			"AAAA": {Record: []string{"::1"}},
		},
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	_, err := h.IngestDNS(context.Background(), req)
	require.NoError(t, err)

	// The event's `records` field is itself a JSON-encoded string.
	var event struct {
		Records string `json:"records"`
	}
	require.NoError(t, json.Unmarshal(capturedBody, &event))

	var records map[string][]string
	require.NoError(t, json.Unmarshal([]byte(event.Records), &records))

	require.Equal(t, []string{"192.168.1.1"}, records["A"])
	require.Equal(t, []string{"::1"}, records["AAAA"])
}

type recordingWorkflows struct {
	called chan workflows.Payload
}

func (c recordingWorkflows) Report(ctx context.Context, payload workflows.Payload) error {
	c.called <- payload
	return nil
}

// TestIngestDNS_ForwardsStatusUpdate guards against DNS results reaching
// Tinybird without ever reaching the alerting pipeline.
func TestIngestDNS_ForwardsStatusUpdate(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))
	client := recordingWorkflows{called: make(chan workflows.Payload, 1)}
	h.WorkflowsClient = client

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:            "dns-result-4",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       12,
		CronTimestamp: 1234567800,
		Uri:           "openstatus.dev",
		RequestStatus: "error",
		Error:         1,
		Message:       "DNS assertions failed for openstatus.dev",
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	_, err := h.IngestDNS(context.Background(), req)
	require.NoError(t, err)

	select {
	case payload := <-client.called:
		require.Equal(t, "5", payload.MonitorID)
		require.Equal(t, "error", payload.Status)
		require.Equal(t, "DNS assertions failed for openstatus.dev", payload.Message)
		require.Equal(t, int64(1234567800), payload.CronTimestamp)
		require.Equal(t, int64(12), payload.Latency)
	case <-time.After(2 * time.Second):
		t.Fatal("expected the DNS result to be forwarded to the workflows service")
	}
}

func TestIngestDNS_WithError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestDNSRequest{
		Id:            "dns-result-3",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       0,
		CronTimestamp: 1234567800,
		Uri:           "dns://example.com",
		Error:         1, // Error occurred
		Message:       "DNS resolution failed",
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestDNS(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}
