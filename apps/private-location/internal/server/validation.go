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
	ErrTooManyAttempts  = errors.New("too many attempts")
)

// maxGRPCStatusCode is UNAUTHENTICATED, the highest canonical code.
const maxGRPCStatusCode = 16

// maxAttempts keeps the final row's attempt count (attempts + 1) inside the
// UInt8 `attempts` column.
const maxAttempts = 254

type ingestAttempt interface {
	GetLatency() int64
	GetTimestamp() int64
}

func validateAttempts[T ingestAttempt](attempts []T) error {
	if len(attempts) > maxAttempts {
		return ErrTooManyAttempts
	}
	for _, attempt := range attempts {
		if attempt.GetLatency() < 0 {
			return ErrInvalidLatency
		}
		if attempt.GetTimestamp() <= 0 {
			return ErrInvalidTimestamp
		}
	}
	return nil
}

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
	if err := validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp); err != nil {
		return err
	}
	return validateAttempts(req.Attempts)
}

// ValidateIngestTCPRequest validates a TCP ingest request
func ValidateIngestTCPRequest(req *private_locationv1.IngestTCPRequest) error {
	if err := validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp); err != nil {
		return err
	}
	return validateAttempts(req.Attempts)
}

// ValidateIngestDNSRequest validates a DNS ingest request
func ValidateIngestDNSRequest(req *private_locationv1.IngestDNSRequest) error {
	if err := validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp); err != nil {
		return err
	}
	return validateAttempts(req.Attempts)
}

// ValidateIngestICMPRequest validates an ICMP ingest request
func ValidateIngestICMPRequest(req *private_locationv1.IngestICMPRequest) error {
	if err := validateIngestCommon(req.MonitorId, req.Latency, req.Timestamp); err != nil {
		return err
	}
	return validateAttempts(req.Attempts)
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
	for _, attempt := range req.Attempts {
		if attempt.GrpcCode < 0 || attempt.GrpcCode > maxGRPCStatusCode {
			return ErrInvalidGRPCCode
		}
		if attempt.Error < 0 || attempt.Error > 1 {
			return ErrInvalidErrorFlag
		}
	}
	return validateAttempts(req.Attempts)
}

// NewValidationError creates a Connect error for validation failures
func NewValidationError(err error) *connect.Error {
	return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("validation error: %w", err))
}
