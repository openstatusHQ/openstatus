package server_test

import (
	"context"
	"database/sql"
	"testing"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/private-location/internal/server"
	private_locationv1 "github.com/openstatushq/openstatus/apps/private-location/proto/private_location/v1"
)

func TestParseAssertions_TextBodyContains(t *testing.T) {
	// Input JSON for the test
	input := `[{"version":"v1","type":"textBody","compare":"contains","target":"mydata"}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	_, _, bodyAssertions := server.ParseAssertions(context.Background(), assertions)

	if len(bodyAssertions) != 1 {
		t.Fatalf("expected 1 body assertion, got %d", len(bodyAssertions))
	}

	got := bodyAssertions[0]
	if got.Target != "mydata" {
		t.Errorf("expected Target to be 'mydata', got '%s'", got.Target)
	}

	if got.Comparator != private_locationv1.StringComparator_STRING_COMPARATOR_CONTAINS {
		t.Errorf("expected Comparator to be STRING_COMPARATOR_CONTAINS, got %v", got.Comparator)
	}
}

func TestParseAssertions_HttpStatusEquals(t *testing.T) {
	// Input JSON for the test
	input := `[{"version":"v1","type":"status","compare":"eq","target":200}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	statusAssertion, _, _ := server.ParseAssertions(context.Background(), assertions)

	if len(statusAssertion) != 1 {
		t.Fatalf("expected 1 body assertion, got %d", len(statusAssertion))
	}

	got := statusAssertion[0]
	if got.Target != 200 {
		t.Errorf("expected Target to be 'mydata', got '%d'", got.Target)
	}

	if got.Comparator != private_locationv1.NumberComparator_NUMBER_COMPARATOR_EQUAL {
		t.Errorf("expected Comparator to be STRING_COMPARATOR_CONTAINS, got %v", got.Comparator)
	}
}

func TestParseAssertions_InvalidJSON(t *testing.T) {
	assertions := sql.NullString{
		String: "not valid json",
		Valid:  true,
	}

	statusAssertions, headerAssertions, bodyAssertions := server.ParseAssertions(context.Background(), assertions)

	if len(statusAssertions) != 0 || len(headerAssertions) != 0 || len(bodyAssertions) != 0 {
		t.Errorf("expected empty assertions for invalid JSON, got status=%d, header=%d, body=%d",
			len(statusAssertions), len(headerAssertions), len(bodyAssertions))
	}
}

func TestParseAssertions_NullString(t *testing.T) {
	assertions := sql.NullString{
		String: "",
		Valid:  false,
	}

	statusAssertions, headerAssertions, bodyAssertions := server.ParseAssertions(context.Background(), assertions)

	if len(statusAssertions) != 0 || len(headerAssertions) != 0 || len(bodyAssertions) != 0 {
		t.Errorf("expected empty assertions for null string, got status=%d, header=%d, body=%d",
			len(statusAssertions), len(headerAssertions), len(bodyAssertions))
	}
}

func TestParseAssertions_HeaderAssertion(t *testing.T) {
	input := `[{"version":"v1","type":"header","compare":"eq","key":"Content-Type","target":"application/json"}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	_, headerAssertions, _ := server.ParseAssertions(context.Background(), assertions)

	if len(headerAssertions) != 1 {
		t.Fatalf("expected 1 header assertion, got %d", len(headerAssertions))
	}

	got := headerAssertions[0]
	if got.Key != "Content-Type" {
		t.Errorf("expected Key to be 'Content-Type', got '%s'", got.Key)
	}
	if got.Target != "application/json" {
		t.Errorf("expected Target to be 'application/json', got '%s'", got.Target)
	}
	if got.Comparator != private_locationv1.StringComparator_STRING_COMPARATOR_EQUAL {
		t.Errorf("expected Comparator to be STRING_COMPARATOR_EQUAL, got %v", got.Comparator)
	}
}

func TestParseAssertions_MultipleAssertions(t *testing.T) {
	input := `[
		{"version":"v1","type":"status","compare":"eq","target":200},
		{"version":"v1","type":"header","compare":"contains","key":"X-Request-Id","target":"req-"},
		{"version":"v1","type":"textBody","compare":"notContains","target":"error"}
	]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	statusAssertions, headerAssertions, bodyAssertions := server.ParseAssertions(context.Background(), assertions)

	if len(statusAssertions) != 1 {
		t.Errorf("expected 1 status assertion, got %d", len(statusAssertions))
	}
	if len(headerAssertions) != 1 {
		t.Errorf("expected 1 header assertion, got %d", len(headerAssertions))
	}
	if len(bodyAssertions) != 1 {
		t.Errorf("expected 1 body assertion, got %d", len(bodyAssertions))
	}
}

func TestMonitors_Unauthenticated(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.MonitorsRequest{})
	// No token header
	resp, err := h.Monitors(context.Background(), req)
	if err == nil {
		t.Fatalf("expected error for missing token, got nil")
	}
	if connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("expected unauthenticated code, got %v", connect.CodeOf(err))
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}
}

func TestMonitors_InvalidToken(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.MonitorsRequest{})
	req.Header().Set("openstatus-token", "invalid-token")

	resp, err := h.Monitors(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error for invalid token (just empty results), got %v", err)
	}
	if resp == nil {
		t.Fatalf("expected non-nil response")
	}
	if len(resp.Msg.HttpMonitors) != 0 {
		t.Errorf("expected 0 HTTP monitors for invalid token, got %d", len(resp.Msg.HttpMonitors))
	}
	if len(resp.Msg.TcpMonitors) != 0 {
		t.Errorf("expected 0 TCP monitors for invalid token, got %d", len(resp.Msg.TcpMonitors))
	}
	if len(resp.Msg.DnsMonitors) != 0 {
		t.Errorf("expected 0 DNS monitors for invalid token, got %d", len(resp.Msg.DnsMonitors))
	}
}

func TestMonitors_ReturnsHTTPTCPAndDNSMonitors(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.MonitorsRequest{})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.Monitors(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp == nil {
		t.Fatalf("expected non-nil response")
	}

	// Should have HTTP monitor (monitor ID 5)
	if len(resp.Msg.HttpMonitors) != 1 {
		t.Errorf("expected 1 HTTP monitor, got %d", len(resp.Msg.HttpMonitors))
	}

	// Should have TCP monitor (monitor ID 6)
	if len(resp.Msg.TcpMonitors) != 1 {
		t.Errorf("expected 1 TCP monitor, got %d", len(resp.Msg.TcpMonitors))
	}

	// Should have DNS monitor (monitor ID 7)
	if len(resp.Msg.DnsMonitors) != 1 {
		t.Errorf("expected 1 DNS monitor, got %d", len(resp.Msg.DnsMonitors))
	}
}

func TestMonitors_HTTPMonitorFields(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.MonitorsRequest{})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.Monitors(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(resp.Msg.HttpMonitors) != 1 {
		t.Fatalf("expected 1 HTTP monitor, got %d", len(resp.Msg.HttpMonitors))
	}

	httpMonitor := resp.Msg.HttpMonitors[0]
	if httpMonitor.Id != "5" {
		t.Errorf("expected ID '5', got '%s'", httpMonitor.Id)
	}
	if httpMonitor.Url != "https://openstat.us" {
		t.Errorf("expected URL 'https://openstat.us', got '%s'", httpMonitor.Url)
	}
	if httpMonitor.Periodicity != "10m" {
		t.Errorf("expected Periodicity '10m', got '%s'", httpMonitor.Periodicity)
	}
	if httpMonitor.Method != "GET" {
		t.Errorf("expected Method 'GET', got '%s'", httpMonitor.Method)
	}
	if httpMonitor.Timeout != 45000 {
		t.Errorf("expected Timeout 45000, got %d", httpMonitor.Timeout)
	}
}

func TestMonitors_TCPMonitorFields(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.MonitorsRequest{})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.Monitors(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(resp.Msg.TcpMonitors) != 1 {
		t.Fatalf("expected 1 TCP monitor, got %d", len(resp.Msg.TcpMonitors))
	}

	tcpMonitor := resp.Msg.TcpMonitors[0]
	if tcpMonitor.Id != "6" {
		t.Errorf("expected ID '6', got '%s'", tcpMonitor.Id)
	}
	if tcpMonitor.Uri != "tcp://db.example.com:5432" {
		t.Errorf("expected URI 'tcp://db.example.com:5432', got '%s'", tcpMonitor.Uri)
	}
	if tcpMonitor.Periodicity != "5m" {
		t.Errorf("expected Periodicity '5m', got '%s'", tcpMonitor.Periodicity)
	}
	if tcpMonitor.Timeout != 30000 {
		t.Errorf("expected Timeout 30000, got %d", tcpMonitor.Timeout)
	}
	if tcpMonitor.Retry != 2 {
		t.Errorf("expected Retry 2, got %d", tcpMonitor.Retry)
	}
	if tcpMonitor.DegradedAt == nil || *tcpMonitor.DegradedAt != 5000 {
		t.Errorf("expected DegradedAt 5000, got %v", tcpMonitor.DegradedAt)
	}
}

func TestParseRecordAssertions_DnsRecordContains(t *testing.T) {
	input := `[{"version":"v1","type":"dnsRecord","key":"A","compare":"contains","target":"76.76.21.21"}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 1 {
		t.Fatalf("expected 1 record assertion, got %d", len(recordAssertions))
	}

	got := recordAssertions[0]
	if got.Record != "A" {
		t.Errorf("expected Record to be 'A', got '%s'", got.Record)
	}
	if got.Target != "76.76.21.21" {
		t.Errorf("expected Target to be '76.76.21.21', got '%s'", got.Target)
	}
	if got.Comparator != private_locationv1.RecordComparator_RECORD_COMPARATOR_CONTAINS {
		t.Errorf("expected Comparator to be RECORD_COMPARATOR_CONTAINS, got %v", got.Comparator)
	}
}

func TestParseRecordAssertions_DnsRecordEquals(t *testing.T) {
	input := `[{"version":"v1","type":"dnsRecord","key":"CNAME","compare":"eq","target":"openstatus.dev"}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 1 {
		t.Fatalf("expected 1 record assertion, got %d", len(recordAssertions))
	}

	got := recordAssertions[0]
	if got.Record != "CNAME" {
		t.Errorf("expected Record to be 'CNAME', got '%s'", got.Record)
	}
	if got.Target != "openstatus.dev" {
		t.Errorf("expected Target to be 'openstatus.dev', got '%s'", got.Target)
	}
	if got.Comparator != private_locationv1.RecordComparator_RECORD_COMPARATOR_EQUAL {
		t.Errorf("expected Comparator to be RECORD_COMPARATOR_EQUAL, got %v", got.Comparator)
	}
}

func TestParseRecordAssertions_MultipleRecordTypes(t *testing.T) {
	input := `[
		{"version":"v1","type":"dnsRecord","key":"A","compare":"eq","target":"192.168.1.1"},
		{"version":"v1","type":"dnsRecord","key":"AAAA","compare":"not_eq","target":"::1"},
		{"version":"v1","type":"dnsRecord","key":"MX","compare":"not_contains","target":"spam"}
	]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 3 {
		t.Fatalf("expected 3 record assertions, got %d", len(recordAssertions))
	}

	// Check A record
	if recordAssertions[0].Record != "A" {
		t.Errorf("expected first Record to be 'A', got '%s'", recordAssertions[0].Record)
	}
	if recordAssertions[0].Comparator != private_locationv1.RecordComparator_RECORD_COMPARATOR_EQUAL {
		t.Errorf("expected first Comparator to be RECORD_COMPARATOR_EQUAL, got %v", recordAssertions[0].Comparator)
	}

	// Check AAAA record
	if recordAssertions[1].Record != "AAAA" {
		t.Errorf("expected second Record to be 'AAAA', got '%s'", recordAssertions[1].Record)
	}
	if recordAssertions[1].Comparator != private_locationv1.RecordComparator_RECORD_COMPARATOR_NOT_EQUAL {
		t.Errorf("expected second Comparator to be RECORD_COMPARATOR_NOT_EQUAL, got %v", recordAssertions[1].Comparator)
	}

	// Check MX record
	if recordAssertions[2].Record != "MX" {
		t.Errorf("expected third Record to be 'MX', got '%s'", recordAssertions[2].Record)
	}
	if recordAssertions[2].Comparator != private_locationv1.RecordComparator_RECORD_COMPARATOR_NOT_CONTAINS {
		t.Errorf("expected third Comparator to be RECORD_COMPARATOR_NOT_CONTAINS, got %v", recordAssertions[2].Comparator)
	}
}

func TestParseRecordAssertions_InvalidJSON(t *testing.T) {
	assertions := sql.NullString{
		String: "not valid json",
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 0 {
		t.Errorf("expected empty assertions for invalid JSON, got %d", len(recordAssertions))
	}
}

func TestParseRecordAssertions_NullString(t *testing.T) {
	assertions := sql.NullString{
		String: "",
		Valid:  false,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if recordAssertions != nil {
		t.Errorf("expected nil for null string, got %v", recordAssertions)
	}
}

func TestParseRecordAssertions_MixedAssertionTypes(t *testing.T) {
	// Test that only dnsRecord assertions are parsed, not other types
	input := `[
		{"version":"v1","type":"status","compare":"eq","target":200},
		{"version":"v1","type":"dnsRecord","key":"A","compare":"contains","target":"192.168.1.1"},
		{"version":"v1","type":"header","compare":"eq","key":"Content-Type","target":"application/json"}
	]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 1 {
		t.Fatalf("expected 1 record assertion (only dnsRecord), got %d", len(recordAssertions))
	}

	if recordAssertions[0].Record != "A" {
		t.Errorf("expected Record to be 'A', got '%s'", recordAssertions[0].Record)
	}
}

func TestMonitors_DNSMonitorFields(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.MonitorsRequest{})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.Monitors(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(resp.Msg.DnsMonitors) != 1 {
		t.Fatalf("expected 1 DNS monitor, got %d", len(resp.Msg.DnsMonitors))
	}

	dnsMonitor := resp.Msg.DnsMonitors[0]
	if dnsMonitor.Id != "7" {
		t.Errorf("expected ID '7', got '%s'", dnsMonitor.Id)
	}
	if dnsMonitor.Uri != "openstatus.dev" {
		t.Errorf("expected URI 'openstatus.dev', got '%s'", dnsMonitor.Uri)
	}
	if dnsMonitor.Periodicity != "5m" {
		t.Errorf("expected Periodicity '5m', got '%s'", dnsMonitor.Periodicity)
	}
	if dnsMonitor.Timeout != 30000 {
		t.Errorf("expected Timeout 30000, got %d", dnsMonitor.Timeout)
	}
	if dnsMonitor.Retry != 2 {
		t.Errorf("expected Retry 2, got %d", dnsMonitor.Retry)
	}
	if dnsMonitor.DegradedAt == nil || *dnsMonitor.DegradedAt != 3000 {
		t.Errorf("expected DegradedAt 3000, got %v", dnsMonitor.DegradedAt)
	}
}

func TestParseRecordAssertions_EmptyArray(t *testing.T) {
	assertions := sql.NullString{
		String: "[]",
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 0 {
		t.Errorf("expected empty slice for empty JSON array, got %d", len(recordAssertions))
	}
}

func TestParseRecordAssertions_UnknownComparator(t *testing.T) {
	input := `[{"version":"v1","type":"dnsRecord","key":"A","compare":"unknown_comparator","target":"192.168.1.1"}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 1 {
		t.Fatalf("expected 1 record assertion, got %d", len(recordAssertions))
	}

	got := recordAssertions[0]
	if got.Comparator != private_locationv1.RecordComparator_RECORD_COMPARATOR_UNSPECIFIED {
		t.Errorf("expected Comparator to be RECORD_COMPARATOR_UNSPECIFIED for unknown comparator, got %v", got.Comparator)
	}
}

func TestParseRecordAssertions_UnknownRecordType(t *testing.T) {
	input := `[{"version":"v1","type":"dnsRecord","key":"INVALID_RECORD_TYPE","compare":"eq","target":"test"}]`
	assertions := sql.NullString{
		String: input,
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 1 {
		t.Fatalf("expected 1 record assertion, got %d", len(recordAssertions))
	}

	got := recordAssertions[0]
	// The record type is passed through as-is, even if invalid
	if got.Record != "INVALID_RECORD_TYPE" {
		t.Errorf("expected Record to be 'INVALID_RECORD_TYPE', got '%s'", got.Record)
	}
}

func TestParseRecordAssertions_MissingRequiredFields(t *testing.T) {
	// Missing "key" field
	inputMissingKey := `[{"version":"v1","type":"dnsRecord","compare":"eq","target":"test"}]`
	assertions := sql.NullString{
		String: inputMissingKey,
		Valid:  true,
	}

	recordAssertions := server.ParseRecordAssertions(context.Background(), assertions)

	if len(recordAssertions) != 1 {
		t.Fatalf("expected 1 record assertion, got %d", len(recordAssertions))
	}

	// Missing key results in empty string
	if recordAssertions[0].Record != "" {
		t.Errorf("expected empty Record for missing key, got '%s'", recordAssertions[0].Record)
	}

	// Missing "compare" field
	inputMissingCompare := `[{"version":"v1","type":"dnsRecord","key":"A","target":"test"}]`
	assertions2 := sql.NullString{
		String: inputMissingCompare,
		Valid:  true,
	}

	recordAssertions2 := server.ParseRecordAssertions(context.Background(), assertions2)

	if len(recordAssertions2) != 1 {
		t.Fatalf("expected 1 record assertion, got %d", len(recordAssertions2))
	}

	// Missing compare results in unspecified comparator
	if recordAssertions2[0].Comparator != private_locationv1.RecordComparator_RECORD_COMPARATOR_UNSPECIFIED {
		t.Errorf("expected RECORD_COMPARATOR_UNSPECIFIED for missing compare, got %v", recordAssertions2[0].Comparator)
	}

	// Missing "target" field
	inputMissingTarget := `[{"version":"v1","type":"dnsRecord","key":"A","compare":"eq"}]`
	assertions3 := sql.NullString{
		String: inputMissingTarget,
		Valid:  true,
	}

	recordAssertions3 := server.ParseRecordAssertions(context.Background(), assertions3)

	if len(recordAssertions3) != 1 {
		t.Fatalf("expected 1 record assertion, got %d", len(recordAssertions3))
	}

	// Missing target results in empty string
	if recordAssertions3[0].Target != "" {
		t.Errorf("expected empty Target for missing target, got '%s'", recordAssertions3[0].Target)
	}
}

func TestMonitors_DNSMonitorWithRecordAssertions(t *testing.T) {
	h := server.NewPrivateLocationServer(testDB(), getTBClient(context.Background()))

	req := connect.NewRequest(&private_locationv1.MonitorsRequest{})
	req.Header().Set("openstatus-token", "my-secret-key")

	resp, err := h.Monitors(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(resp.Msg.DnsMonitors) != 1 {
		t.Fatalf("expected 1 DNS monitor, got %d", len(resp.Msg.DnsMonitors))
	}

	dnsMonitor := resp.Msg.DnsMonitors[0]
	if len(dnsMonitor.RecordAssertions) != 1 {
		t.Fatalf("expected 1 record assertion, got %d", len(dnsMonitor.RecordAssertions))
	}

	assertion := dnsMonitor.RecordAssertions[0]
	if assertion.Record != "A" {
		t.Errorf("expected Record 'A', got '%s'", assertion.Record)
	}
	if assertion.Target != "76.76.21.21" {
		t.Errorf("expected Target '76.76.21.21', got '%s'", assertion.Target)
	}
	if assertion.Comparator != private_locationv1.RecordComparator_RECORD_COMPARATOR_CONTAINS {
		t.Errorf("expected Comparator RECORD_COMPARATOR_CONTAINS, got %v", assertion.Comparator)
	}
}
