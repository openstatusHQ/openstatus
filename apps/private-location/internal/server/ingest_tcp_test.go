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

// TestIngestTCP_ForwardsErrorMessage guards against the probe's failure message
// being dropped: it never reached Tinybird or the alert body.
func TestIngestTCP_ForwardsErrorMessage(t *testing.T) {
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
	workflowsClient := recordingWorkflows{called: make(chan workflows.Payload, 1)}
	h.WorkflowsClient = workflowsClient

	const message = "dial tcp 10.0.0.1:5432: connect: connection refused"
	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:            "tcp-err",
		MonitorId:     "6",
		Timestamp:     1234567890,
		CronTimestamp: 1234567800,
		Uri:           "10.0.0.1:5432",
		RequestStatus: "error",
		Error:         1,
		Message:       message,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	_, err := h.IngestTCP(context.Background(), req)
	require.NoError(t, err)

	var event struct {
		ErrorMessage string `json:"errorMessage"`
	}
	require.NoError(t, json.Unmarshal(capturedBody, &event))
	require.Equal(t, message, event.ErrorMessage)

	select {
	case payload := <-workflowsClient.called:
		require.Equal(t, "error", payload.Status)
		require.Equal(t, message, payload.Message)
	case <-time.After(2 * time.Second):
		t.Fatal("expected the failed check to be forwarded to the workflows service")
	}
}

func TestIngestTCP_Unauthenticated(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{})
	// No token header
	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_DBError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{})
	req.Header().Set("openstatus-token", "token123")
	req.Msg.Id = "monitor1"
	req.Msg.MonitorId = "monitor1"
	req.Msg.Timestamp = 1234567890
	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_ValidationError_EmptyID(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:        "",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_ValidationError_InvalidTimestamp(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:        "tcp-123",
		MonitorId: "5",
		Timestamp: 0,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_ValidationError_NegativeLatency(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:        "tcp-123",
		MonitorId: "5",
		Latency:   -100,
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_MonitorNotExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), tinybird.NewClient(http.DefaultClient, ""))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:        "tcp-123",
		MonitorId: "nonexistent-monitor",
		Timestamp: 1234567890,
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
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

func TestIngestTCP_MonitorExist(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:            "tcp-result-1",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       50,
		CronTimestamp: 1234567800,
		Uri:           "tcp://example.com:8080",
		Timing:        "50ms",
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}

func TestIngestTCP_WithError(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.IngestTCPRequest{
		Id:            "tcp-result-2",
		MonitorId:     "5",
		Timestamp:     1234567890,
		Latency:       0,
		CronTimestamp: 1234567800,
		Uri:           "tcp://example.com:8080",
		Error:         1,
		Message:       "Connection refused",
	})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.IngestTCP(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Errorf("expected not nil response, got nil")
	}
}
