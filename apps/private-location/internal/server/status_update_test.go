package server

import (
	"context"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
	"github.com/openstatushq/openstatus/apps/private-location/internal/workflows"
)

func TestClassifyStatus(t *testing.T) {
	tests := []struct {
		name          string
		requestStatus string
		errorFlag     uint8
		want          string
	}{
		{"http success", "success", 0, "active"},
		{"tcp active", "active", 0, "active"},
		{"degraded", "degraded", 0, "degraded"},
		{"error", "error", 0, "error"},
		{"explicit error wins over flag", "error", 0, "error"},
		{"request status wins over error flag", "success", 1, "active"},
		{"empty falls back to active", "", 0, "active"},
		{"empty with error flag falls back to error", "", 1, "error"},
		{"unknown falls back to active", "weird", 0, "active"},
		{"unknown with error flag falls back to error", "weird", 1, "error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := classifyStatus(tt.requestStatus, tt.errorFlag)
			if got != tt.want {
				t.Errorf("classifyStatus(%q, %d) = %q, want %q", tt.requestStatus, tt.errorFlag, got, tt.want)
			}
		})
	}
}

type recordingWorkflowsClient struct {
	called   chan workflows.Payload
	blockFor time.Duration
}

func (c recordingWorkflowsClient) Report(ctx context.Context, payload workflows.Payload) error {
	if c.blockFor > 0 {
		time.Sleep(c.blockFor)
	}
	c.called <- payload
	return nil
}

func TestForwardStatusUpdateNilClientIsNoop(t *testing.T) {
	h := &privateLocationHandler{}
	ic := &ingestContext{
		Monitor: database.Monitor{ID: 1},
		Region:  database.PrivateLocation{ID: 2},
	}
	// Must not panic with a nil WorkflowsClient.
	h.forwardStatusUpdate(context.Background(), ic, statusUpdateInput{RequestStatus: "error", ErrorFlag: 1})
}

func TestForwardStatusUpdateDoesNotBlock(t *testing.T) {
	client := recordingWorkflowsClient{called: make(chan workflows.Payload, 1), blockFor: 200 * time.Millisecond}
	h := &privateLocationHandler{WorkflowsClient: client}
	ic := &ingestContext{
		Monitor: database.Monitor{ID: 7},
		Region:  database.PrivateLocation{ID: 9},
	}

	start := time.Now()
	h.forwardStatusUpdate(context.Background(), ic, statusUpdateInput{
		RequestStatus: "error",
		ErrorFlag:     1,
		CronTimestamp: 1700000000000,
	})
	if elapsed := time.Since(start); elapsed > 100*time.Millisecond {
		t.Fatalf("forwardStatusUpdate blocked for %s, expected to return immediately", elapsed)
	}

	select {
	case payload := <-client.called:
		if payload.MonitorID != "7" || payload.PrivateLocationID != "9" || payload.Status != "error" {
			t.Fatalf("unexpected payload: %+v", payload)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Report was never called by the detached goroutine")
	}
}
