package server

import (
	"errors"
	"testing"

	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

// The four pre-existing validators now share one helper, so this covers the
// rules once rather than four times.
func TestValidateIngestCommon(t *testing.T) {
	cases := []struct {
		name      string
		monitorID string
		latency   int64
		timestamp int64
		want      error
	}{
		{name: "valid", monitorID: "1", latency: 10, timestamp: 1761000000000},
		{name: "zero latency is fine", monitorID: "1", latency: 0, timestamp: 1761000000000},
		{name: "missing monitor id", monitorID: "", latency: 10, timestamp: 1, want: ErrEmptyMonitorID},
		{name: "negative latency", monitorID: "1", latency: -1, timestamp: 1, want: ErrInvalidLatency},
		{name: "zero timestamp", monitorID: "1", latency: 10, timestamp: 0, want: ErrInvalidTimestamp},
		{name: "negative timestamp", monitorID: "1", latency: 10, timestamp: -5, want: ErrInvalidTimestamp},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateIngestCommon(tc.monitorID, tc.latency, tc.timestamp)
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}

func TestValidateIngestGRPCRequest(t *testing.T) {
	valid := func() *private_locationv1.IngestGRPCRequest {
		return &private_locationv1.IngestGRPCRequest{
			Id:            "01",
			MonitorId:     "1",
			Latency:       120,
			Timestamp:     1761000000000,
			CronTimestamp: 1761000000000,
			GrpcCode:      0,
			Error:         0,
		}
	}

	if err := ValidateIngestGRPCRequest(valid()); err != nil {
		t.Fatalf("expected a valid request to pass, got %v", err)
	}

	t.Run("inherits the shared rules", func(t *testing.T) {
		req := valid()
		req.Timestamp = 0
		if err := ValidateIngestGRPCRequest(req); !errors.Is(err, ErrInvalidTimestamp) {
			t.Fatalf("got %v, want %v", err, ErrInvalidTimestamp)
		}
	})

	// Both fields are narrowed on the way into the Tinybird row, so an
	// out-of-range value would wrap into a plausible-looking one.
	t.Run("rejects an out of range status code", func(t *testing.T) {
		for _, code := range []int64{-1, 17, 300} {
			req := valid()
			req.GrpcCode = code
			if err := ValidateIngestGRPCRequest(req); !errors.Is(err, ErrInvalidGRPCCode) {
				t.Fatalf("code %d: got %v, want %v", code, err, ErrInvalidGRPCCode)
			}
		}
	})

	t.Run("accepts every canonical status code", func(t *testing.T) {
		for code := int64(0); code <= maxGRPCStatusCode; code++ {
			req := valid()
			req.GrpcCode = code
			if err := ValidateIngestGRPCRequest(req); err != nil {
				t.Fatalf("code %d should be valid, got %v", code, err)
			}
		}
	})

	t.Run("rejects an out of range error flag", func(t *testing.T) {
		for _, flag := range []int64{-1, 2, 256} {
			req := valid()
			req.Error = flag
			if err := ValidateIngestGRPCRequest(req); !errors.Is(err, ErrInvalidErrorFlag) {
				t.Fatalf("flag %d: got %v, want %v", flag, err, ErrInvalidErrorFlag)
			}
		}
	})
}
