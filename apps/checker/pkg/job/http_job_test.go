package job_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/stretchr/testify/assert"
)

// Save original checker.Http for restoration

func TestHTTPJob_Success(t *testing.T) {

	// Mock checker.Http to simulate success

	monitor := &v1.HTTPMonitor{
		Url:     "https://openstat.us",
		Method:  "GET",
		Timeout: 10000,
		Retry:   2,
	}

	data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor, "test-region")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if data.RequestStatus != "success" {
		t.Errorf("expected RequestStatus 'success', got '%s'", data.RequestStatus)
	}
	if data.Error != 0 {
		t.Errorf("expected Error 0, got %d", data.Error)
	}
}

func TestHTTPJob_Failure(t *testing.T) {

	monitor := &v1.HTTPMonitor{
		Url:     "https://localhost:1234",
		Method:  "GET",
		Timeout: 1000,
		Retry:   1,
	}

	data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor, "test-region")
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if data != nil {
		t.Errorf("expected data to be nil on error, got %+v", data)
	}
}

func TestProtoStringAssertionToComparator(t *testing.T) {
	tests := []struct {
		name      string
		input     v1.StringComparator
		want      request.StringComparator
		expectErr bool
	}{
		{
			name:      "Contains",
			input:     v1.StringComparator_STRING_COMPARATOR_CONTAINS,
			want:      request.StringContains,
			expectErr: false,
		},
		{
			name:      "NotContains",
			input:     v1.StringComparator_STRING_COMPARATOR_NOT_CONTAINS,
			want:      request.StringNotContains,
			expectErr: false,
		},
		{
			name:      "Equals",
			input:     v1.StringComparator_STRING_COMPARATOR_EQUAL,
			want:      request.StringEquals,
			expectErr: false,
		},
		{
			name:      "NotEquals",
			input:     v1.StringComparator_STRING_COMPARATOR_NOT_EQUAL,
			want:      request.StringNotEquals,
			expectErr: false,
		},
		{
			name:      "Empty",
			input:     v1.StringComparator_STRING_COMPARATOR_EMPTY,
			want:      request.StringEmpty,
			expectErr: false,
		},
		{
			name:      "NotEmpty",
			input:     v1.StringComparator_STRING_COMPARATOR_NOT_EMPTY,
			want:      request.StringNotEmpty,
			expectErr: false,
		},
		{
			name:      "Unknown",
			input:     v1.StringComparator(999),
			want:      "",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := job.ProtoStringAssertionToComparator(tt.input)
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestProtoNumberAssertionToComparator(t *testing.T) {
	tests := []struct {
		name      string
		input     v1.NumberComparator
		want      request.NumberComparator
		expectErr bool
	}{
		{"Equal", v1.NumberComparator_NUMBER_COMPARATOR_EQUAL, request.NumberEquals, false},
		{"NotEqual", v1.NumberComparator_NUMBER_COMPARATOR_NOT_EQUAL, request.NumberNotEquals, false},
		{"GreaterThan", v1.NumberComparator_NUMBER_COMPARATOR_GREATER_THAN, request.NumberGreaterThan, false},
		{"GreaterThanOrEqual", v1.NumberComparator_NUMBER_COMPARATOR_GREATER_THAN_OR_EQUAL, request.NumberGreaterThanEqual, false},
		{"LessThan", v1.NumberComparator_NUMBER_COMPARATOR_LESS_THAN, request.NumberLowerThan, false},
		{"LessThanOrEqual", v1.NumberComparator_NUMBER_COMPARATOR_LESS_THAN_OR_EQUAL, request.NumberLowerThanEqual, false},
		{"Unknown", v1.NumberComparator(999), "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := job.ProtoNumberAssertionToComparator(tt.input)
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

// TestHTTPJob_HeaderAssertions ensures that header assertions influence the
// request status for the private location scheduler, matching the behaviour of
// the public checker. Regression test for a bug where the result of
// HeaderEvaluate was discarded, so a failing header assertion was still
// reported as a success.
func TestHTTPJob_HeaderAssertions(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Custom", "actual")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	newMonitor := func(target string) *v1.HTTPMonitor {
		return &v1.HTTPMonitor{
			Url:     srv.URL,
			Method:  "GET",
			Timeout: 10000,
			Retry:   1,
			HeaderAssertions: []*v1.HeaderAssertion{
				{
					Key:        "X-Custom",
					Comparator: v1.StringComparator_STRING_COMPARATOR_EQUAL,
					Target:     target,
				},
			},
		}
	}

	t.Run("failing header assertion marks request as error", func(t *testing.T) {
		monitor := newMonitor("expected")

		data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor, "test-region")
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		assert.Equal(t, "error", data.RequestStatus)
		assert.Equal(t, uint8(1), data.Error)
	})

	t.Run("passing header assertion keeps request successful", func(t *testing.T) {
		monitor := newMonitor("actual")

		data, err := job.NewJobRunner().HTTPJob(context.Background(), monitor, "test-region")
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		assert.Equal(t, "success", data.RequestStatus)
		assert.Equal(t, uint8(0), data.Error)
	})
}
