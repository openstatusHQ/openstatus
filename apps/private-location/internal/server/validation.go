package server

import (
	"errors"
	"fmt"

	"connectrpc.com/connect"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

// Validation errors
var (
	ErrEmptyMonitorID  = errors.New("monitor_id is required")
	ErrEmptyID         = errors.New("id is required")
	ErrInvalidLatency  = errors.New("latency must be non-negative")
	ErrInvalidTimestamp = errors.New("timestamp must be positive")
)

// ValidateIngestHTTPRequest validates an HTTP ingest request
func ValidateIngestHTTPRequest(req *private_locationv1.IngestHTTPRequest) error {
	if req.MonitorId == "" {
		return ErrEmptyMonitorID
	}
	if req.Latency < 0 {
		return ErrInvalidLatency
	}
	if req.Timestamp <= 0 {
		return ErrInvalidTimestamp
	}
	return nil
}

// ValidateIngestTCPRequest validates a TCP ingest request
func ValidateIngestTCPRequest(req *private_locationv1.IngestTCPRequest) error {
	if req.Id == "" {
		return ErrEmptyID
	}
	if req.Latency < 0 {
		return ErrInvalidLatency
	}
	if req.Timestamp <= 0 {
		return ErrInvalidTimestamp
	}
	return nil
}

// ValidateIngestDNSRequest validates a DNS ingest request
func ValidateIngestDNSRequest(req *private_locationv1.IngestDNSRequest) error {
	if req.Id == "" {
		return ErrEmptyID
	}
	if req.Latency < 0 {
		return ErrInvalidLatency
	}
	if req.Timestamp <= 0 {
		return ErrInvalidTimestamp
	}
	return nil
}

// NewValidationError creates a Connect error for validation failures
func NewValidationError(err error) *connect.Error {
	return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("validation error: %w", err))
}
