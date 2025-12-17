package handlers_test

import (
	"encoding/json"
	"reflect"
	"testing"

	// Adjust the import path if necessary to point to the correct package
	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/handlers"
)

// Mock DNSResult struct to match the expected input for FormatDNSResult.
// If the real struct is in another package, import it accordingly.
type DNSResult struct {
	A     []string
	AAAA  []string
	CNAME string
	MX    []string
	NS    []string
	TXT   []string
}

func TestFormatDNSResult(t *testing.T) {
	tests := []struct {
		name     string
		input    DNSResult
		expected map[string][]string
	}{
		{
			name: "All fields populated",
			input: DNSResult{
				A:     []string{"1.2.3.4", "5.6.7.8"},
				AAAA:  []string{"::1", "2001:db8::1"},
				CNAME: "example.com",
				MX:    []string{"mx1.example.com", "mx2.example.com"},
				NS:    []string{"ns1.example.com", "ns2.example.com"},
				TXT:   []string{"v=spf1", "google-site-verification=abc"},
			},
			expected: map[string][]string{
				"A":     {"1.2.3.4", "5.6.7.8"},
				"AAAA":  {"::1", "2001:db8::1"},
				"CNAME": {"example.com"},
				"MX":    {"mx1.example.com", "mx2.example.com"},
				"NS":    {"ns1.example.com", "ns2.example.com"},
				"TXT":   {"v=spf1", "google-site-verification=abc"},
			},
		},
		{
			name: "Empty fields",
			input: DNSResult{
				A:     []string{},
				AAAA:  []string{},
				CNAME: "",
				MX:    []string{},
				NS:    []string{},
				TXT:   []string{},
			},
			expected: map[string][]string{
				"A":     {},
				"AAAA":  {},
				"CNAME": {""},
				"MX":    {},
				"NS":    {},
				"TXT":   {},
			},
		},
		{
			name: "Single values",
			input: DNSResult{
				A:     []string{"8.8.8.8"},
				AAAA:  []string{"fe80::1"},
				CNAME: "single.example.com",
				MX:    []string{"mx.single.com"},
				NS:    []string{"ns.single.com"},
				TXT:   []string{"single-txt"},
			},
			expected: map[string][]string{
				"A":     {"8.8.8.8"},
				"AAAA":  {"fe80::1"},
				"CNAME": {"single.example.com"},
				"MX":    {"mx.single.com"},
				"NS":    {"ns.single.com"},
				"TXT":   {"single-txt"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := handlers.FormatDNSResult(&checker.DnsResponse{
				A:     tt.input.A,
				AAAA:  tt.input.AAAA,
				CNAME: tt.input.CNAME,
				MX:    tt.input.MX,
				NS:    tt.input.NS,
				TXT:   tt.input.TXT,
			})
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("FormatDNSResult() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestEvaluateDNSAssertions(t *testing.T) {
	type args struct {
		rawAssertions []json.RawMessage
		response      *checker.DnsResponse
	}
	tests := []struct {
		name        string
		args        args
		wantSuccess bool
		wantErr     bool
	}{
		{
			name: "A record matches",
			args: args{
				rawAssertions: []json.RawMessage{
					json.RawMessage(`{"key":"A","compare":"eq","target":"1.2.3.4"}`),
				},
				response: &checker.DnsResponse{
					A: []string{"1.2.3.4", "5.6.7.8"},
				},
			},
			wantSuccess: true,
			wantErr:     false,
		},
		{
			name: "CNAME does not match",
			args: args{
				rawAssertions: []json.RawMessage{
					json.RawMessage(`{"key":"CNAME","compare":"eq","target":"not-example.com"}`),
				},
				response: &checker.DnsResponse{
					CNAME: "example.com",
				},
			},
			wantSuccess: false,
			wantErr:     false,
		},
		{
			name: "CNAME Contains",
			args: args{
				rawAssertions: []json.RawMessage{
					json.RawMessage(`{"version":"v1","type":"dnsRecord","key":"CNAME","compare":"contains","target":"openstatus.dev"}`),
				},
				response: &checker.DnsResponse{
					CNAME: "openstatus.dev.",
				},
			},
			wantSuccess: true,
			wantErr:     false,
		},
		{
			name: "Unknown record type",
			args: args{
				rawAssertions: []json.RawMessage{
					json.RawMessage(`{"key":"FOO","compare":"eq","target":"bar"}`),
				},
				response: &checker.DnsResponse{},
			},
			wantSuccess: false,
			wantErr:     true,
		},
		{
			name: "Invalid assertion JSON",
			args: args{
				rawAssertions: []json.RawMessage{
					json.RawMessage(`not a json`),
				},
				response: &checker.DnsResponse{},
			},
			wantSuccess: false,
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := handlers.EvaluateDNSAssertions(tt.args.rawAssertions, tt.args.response)
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.wantSuccess {
				t.Errorf("EvaluateDNSAssertions() = %v, want %v", got, tt.wantSuccess)
			}
		})
	}
}
