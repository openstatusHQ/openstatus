package server_test

import (
	"testing"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

func TestValidateIngestHTTPRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     *private_locationv1.IngestHTTPRequest
		wantErr error
	}{
		{
			name: "valid request",
			req: &private_locationv1.IngestHTTPRequest{
				MonitorId: "monitor-123",
				Latency:   100,
				Timestamp: 1234567890,
			},
			wantErr: nil,
		},
		{
			name: "valid request with zero latency",
			req: &private_locationv1.IngestHTTPRequest{
				MonitorId: "monitor-123",
				Latency:   0,
				Timestamp: 1234567890,
			},
			wantErr: nil,
		},
		{
			name: "empty monitor_id",
			req: &private_locationv1.IngestHTTPRequest{
				MonitorId: "",
				Latency:   100,
				Timestamp: 1234567890,
			},
			wantErr: server.ErrEmptyMonitorID,
		},
		{
			name: "negative latency",
			req: &private_locationv1.IngestHTTPRequest{
				MonitorId: "monitor-123",
				Latency:   -1,
				Timestamp: 1234567890,
			},
			wantErr: server.ErrInvalidLatency,
		},
		{
			name: "zero timestamp",
			req: &private_locationv1.IngestHTTPRequest{
				MonitorId: "monitor-123",
				Latency:   100,
				Timestamp: 0,
			},
			wantErr: server.ErrInvalidTimestamp,
		},
		{
			name: "negative timestamp",
			req: &private_locationv1.IngestHTTPRequest{
				MonitorId: "monitor-123",
				Latency:   100,
				Timestamp: -1,
			},
			wantErr: server.ErrInvalidTimestamp,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := server.ValidateIngestHTTPRequest(tt.req)
			if err != tt.wantErr {
				t.Errorf("ValidateIngestHTTPRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateIngestTCPRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     *private_locationv1.IngestTCPRequest
		wantErr error
	}{
		{
			name: "valid request",
			req: &private_locationv1.IngestTCPRequest{
				Id:        "tcp-123",
				Latency:   100,
				Timestamp: 1234567890,
			},
			wantErr: nil,
		},
		{
			name: "valid request with zero latency",
			req: &private_locationv1.IngestTCPRequest{
				Id:        "tcp-123",
				Latency:   0,
				Timestamp: 1234567890,
			},
			wantErr: nil,
		},
		{
			name: "empty id",
			req: &private_locationv1.IngestTCPRequest{
				Id:        "",
				Latency:   100,
				Timestamp: 1234567890,
			},
			wantErr: server.ErrEmptyID,
		},
		{
			name: "negative latency",
			req: &private_locationv1.IngestTCPRequest{
				Id:        "tcp-123",
				Latency:   -1,
				Timestamp: 1234567890,
			},
			wantErr: server.ErrInvalidLatency,
		},
		{
			name: "zero timestamp",
			req: &private_locationv1.IngestTCPRequest{
				Id:        "tcp-123",
				Latency:   100,
				Timestamp: 0,
			},
			wantErr: server.ErrInvalidTimestamp,
		},
		{
			name: "negative timestamp",
			req: &private_locationv1.IngestTCPRequest{
				Id:        "tcp-123",
				Latency:   100,
				Timestamp: -1,
			},
			wantErr: server.ErrInvalidTimestamp,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := server.ValidateIngestTCPRequest(tt.req)
			if err != tt.wantErr {
				t.Errorf("ValidateIngestTCPRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateIngestDNSRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     *private_locationv1.IngestDNSRequest
		wantErr error
	}{
		{
			name: "valid request",
			req: &private_locationv1.IngestDNSRequest{
				Id:        "dns-123",
				Latency:   100,
				Timestamp: 1234567890,
			},
			wantErr: nil,
		},
		{
			name: "valid request with zero latency",
			req: &private_locationv1.IngestDNSRequest{
				Id:        "dns-123",
				Latency:   0,
				Timestamp: 1234567890,
			},
			wantErr: nil,
		},
		{
			name: "empty id",
			req: &private_locationv1.IngestDNSRequest{
				Id:        "",
				Latency:   100,
				Timestamp: 1234567890,
			},
			wantErr: server.ErrEmptyID,
		},
		{
			name: "negative latency",
			req: &private_locationv1.IngestDNSRequest{
				Id:        "dns-123",
				Latency:   -1,
				Timestamp: 1234567890,
			},
			wantErr: server.ErrInvalidLatency,
		},
		{
			name: "zero timestamp",
			req: &private_locationv1.IngestDNSRequest{
				Id:        "dns-123",
				Latency:   100,
				Timestamp: 0,
			},
			wantErr: server.ErrInvalidTimestamp,
		},
		{
			name: "negative timestamp",
			req: &private_locationv1.IngestDNSRequest{
				Id:        "dns-123",
				Latency:   100,
				Timestamp: -1,
			},
			wantErr: server.ErrInvalidTimestamp,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := server.ValidateIngestDNSRequest(tt.req)
			if err != tt.wantErr {
				t.Errorf("ValidateIngestDNSRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNewValidationError(t *testing.T) {
	tests := []struct {
		name         string
		err          error
		wantCode     connect.Code
		wantContains string
	}{
		{
			name:         "empty monitor id error",
			err:          server.ErrEmptyMonitorID,
			wantCode:     connect.CodeInvalidArgument,
			wantContains: "monitor_id is required",
		},
		{
			name:         "empty id error",
			err:          server.ErrEmptyID,
			wantCode:     connect.CodeInvalidArgument,
			wantContains: "id is required",
		},
		{
			name:         "invalid latency error",
			err:          server.ErrInvalidLatency,
			wantCode:     connect.CodeInvalidArgument,
			wantContains: "latency must be non-negative",
		},
		{
			name:         "invalid timestamp error",
			err:          server.ErrInvalidTimestamp,
			wantCode:     connect.CodeInvalidArgument,
			wantContains: "timestamp must be positive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			connErr := server.NewValidationError(tt.err)
			if connErr.Code() != tt.wantCode {
				t.Errorf("NewValidationError() code = %v, want %v", connErr.Code(), tt.wantCode)
			}
			if connErr.Message() == "" {
				t.Error("NewValidationError() message should not be empty")
			}
		})
	}
}
