package server_test

import (
	"context"
	"database/sql"
	"testing"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

func monitorsResponse(t *testing.T) *private_locationv1.MonitorsResponse {
	t.Helper()
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.MonitorsRequest{})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.Monitors(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	return resp.Msg
}

func TestMonitors_Region(t *testing.T) {
	msg := monitorsResponse(t)
	if msg.Region != "My Home" {
		t.Errorf("expected Region 'My Home', got '%s'", msg.Region)
	}
}

func TestMonitors_HTTPMonitorOtelConfig(t *testing.T) {
	msg := monitorsResponse(t)
	if len(msg.HttpMonitors) != 1 {
		t.Fatalf("expected 1 HTTP monitor, got %d", len(msg.HttpMonitors))
	}

	otel := msg.HttpMonitors[0].OtelConfig
	if otel == nil {
		t.Fatalf("expected OtelConfig, got nil")
	}
	if otel.Endpoint != "https://otel.example.com:4318" {
		t.Errorf("expected endpoint 'https://otel.example.com:4318', got '%s'", otel.Endpoint)
	}
	if len(otel.Headers) != 1 {
		t.Fatalf("expected 1 otel header, got %d", len(otel.Headers))
	}
	if otel.Headers[0].Key != "Authorization" || otel.Headers[0].Value != "Bearer token" {
		t.Errorf("unexpected otel header: %+v", otel.Headers[0])
	}
}

func TestMonitors_TCPMonitorNoOtelConfig(t *testing.T) {
	msg := monitorsResponse(t)
	if len(msg.TcpMonitors) != 1 {
		t.Fatalf("expected 1 TCP monitor, got %d", len(msg.TcpMonitors))
	}
	if msg.TcpMonitors[0].OtelConfig != nil {
		t.Errorf("expected nil OtelConfig for monitor without otel_endpoint, got %+v", msg.TcpMonitors[0].OtelConfig)
	}
}

func TestParseOtelHeaders(t *testing.T) {
	tests := []struct {
		name string
		raw  sql.NullString
		want int
	}{
		{"valid", sql.NullString{String: `[{"key":"A","value":"1"},{"key":"B","value":"2"}]`, Valid: true}, 2},
		{"null", sql.NullString{Valid: false}, 0},
		{"empty", sql.NullString{String: "", Valid: true}, 0},
		{"invalid", sql.NullString{String: "not json", Valid: true}, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := server.ParseOtelHeaders(context.Background(), tt.raw)
			if len(got) != tt.want {
				t.Errorf("expected %d headers, got %d", tt.want, len(got))
			}
		})
	}
}
