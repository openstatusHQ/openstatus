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

	_, _, bodyAssertions := server.ParseAssertions(assertions)

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

	statusAssertion, _, _ := server.ParseAssertions(assertions)

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

	statusAssertions, headerAssertions, bodyAssertions := server.ParseAssertions(assertions)

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

	statusAssertions, headerAssertions, bodyAssertions := server.ParseAssertions(assertions)

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

	_, headerAssertions, _ := server.ParseAssertions(assertions)

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

	statusAssertions, headerAssertions, bodyAssertions := server.ParseAssertions(assertions)

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
}

func TestMonitors_ReturnsHTTPAndTCPMonitors(t *testing.T) {
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
