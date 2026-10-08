package server

import (
	"errors"
	"fmt"

	"connectrpc.com/connect"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

// Validation errors
var (
	ErrEmptyMonitorID   = errors.New("monitor_id is required")
	ErrEmptyID          = errors.New("id is required")
	ErrInvalidLatency   = errors.New("latency must be non-negative")
	ErrInvalidTimestamp = errors.New("timestamp must be positive")
	ErrInvalidGRPCCode  = errors.New("grpc_code must be a canonical gRPC status code")
	ErrInvalidErrorFlag = errors.New("error must be 0 or 1")
)

// maxGRPCStatusCode is UNAUTHENTICATED, the highest canonical code.
const maxGRPCStatusCode = 16

// validateIngestCommon holds the rules every ingest request shares. Keeping one
// copy stops the per-type validators drifting as the rules change.
func validateIngestCommon(monitorID string, latency, timestamp int64) error {
	if monitorID == "" {
		return ErrEmptyMonitorID
	}
	if latency < 0 {
		return ErrInvalidLatency
	}
	if timestamp <= 0 {
		return ErrInvalidTimestamp
	}
	return nil
}

// ValidateIngestHTTPRequest validates an HTTP ingest request
func ValidateIngestHTTPRequest(req *private_locationv1.IngestHTTPRequest) error {
	return validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp)
}

// ValidateIngestTCPRequest validates a TCP ingest request
func ValidateIngestTCPRequest(req *private_locationv1.IngestTCPRequest) error {
	return validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp)
}

// ValidateIngestDNSRequest validates a DNS ingest request
func ValidateIngestDNSRequest(req *private_locationv1.IngestDNSRequest) error {
	return validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp)
}

// ValidateIngestICMPRequest validates an ICMP ingest request
func ValidateIngestICMPRequest(req *private_locationv1.IngestICMPRequest) error {
	return validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp)
}

// ValidateIngestGRPCRequest validates a gRPC ingest request. The two numeric
// fields are narrowed on the way into the Tinybird row, so they are bounded
// here rather than wrapping silently.
func ValidateIngestGRPCRequest(req *private_locationv1.IngestGRPCRequest) error {
	if err := validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp); err != nil {
		return err
	}
	if req.GrpcCode < 0 || req.GrpcCode > maxGRPCStatusCode {
		return ErrInvalidGRPCCode
	}
	if req.Error < 0 || req.Error > 1 {
		return ErrInvalidErrorFlag
	}
	return nil
}

// NewValidationError creates a Connect error for validation failures
func NewValidationError(err error) *connect.Error {
	return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("validation error: %w", err))
}
