package job

import (
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/checker"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

func TestEvaluateRecordAssertions(t *testing.T) {
	response := &checker.DnsResponse{
		A:     []string{"1.2.3.4", "5.6.7.8"},
		AAAA:  []string{"::1"},
		CNAME: "openstatus.dev.",
		MX:    []string{"mx1.openstatus.dev:10"},
		NS:    []string{"ns1.openstatus.dev"},
		TXT:   []string{"v=spf1"},
	}

	tests := []struct {
		name       string
		assertions []*v1.RecordAssertion
		want       bool
		wantErr    bool
	}{
		{
			name:       "no assertions",
			assertions: nil,
			want:       true,
		},
		{
			name: "A record matches",
			assertions: []*v1.RecordAssertion{
				{Record: "A", Comparator: v1.RecordComparator_RECORD_COMPARATOR_EQUAL, Target: "1.2.3.4"},
			},
			want: true,
		},
		{
			name: "A record does not match",
			assertions: []*v1.RecordAssertion{
				{Record: "A", Comparator: v1.RecordComparator_RECORD_COMPARATOR_EQUAL, Target: "9.9.9.9"},
			},
			want: false,
		},
		{
			name: "CNAME contains",
			assertions: []*v1.RecordAssertion{
				{Record: "CNAME", Comparator: v1.RecordComparator_RECORD_COMPARATOR_CONTAINS, Target: "openstatus.dev"},
			},
			want: true,
		},
		{
			name: "TXT not contains",
			assertions: []*v1.RecordAssertion{
				{Record: "TXT", Comparator: v1.RecordComparator_RECORD_COMPARATOR_NOT_CONTAINS, Target: "dkim"},
			},
			want: true,
		},
		{
			name: "every assertion must hold",
			assertions: []*v1.RecordAssertion{
				{Record: "A", Comparator: v1.RecordComparator_RECORD_COMPARATOR_EQUAL, Target: "1.2.3.4"},
				{Record: "NS", Comparator: v1.RecordComparator_RECORD_COMPARATOR_EQUAL, Target: "ns2.openstatus.dev"},
			},
			want: false,
		},
		{
			name: "unknown record type",
			assertions: []*v1.RecordAssertion{
				{Record: "FOO", Comparator: v1.RecordComparator_RECORD_COMPARATOR_EQUAL, Target: "bar"},
			},
			wantErr: true,
		},
		{
			name: "unspecified comparator",
			assertions: []*v1.RecordAssertion{
				{Record: "A", Comparator: v1.RecordComparator_RECORD_COMPARATOR_UNSPECIFIED, Target: "1.2.3.4"},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := evaluateRecordAssertions(tt.assertions, response)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if got != tt.want {
				t.Errorf("evaluateRecordAssertions() = %v, want %v", got, tt.want)
			}
		})
	}
}
