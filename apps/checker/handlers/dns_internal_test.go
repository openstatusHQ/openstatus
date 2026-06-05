package handlers

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestTinybirdEventRecordsIsString(t *testing.T) {
	records := map[string][]string{
		"A":     {"1.2.3.4", "5.6.7.8"},
		"CNAME": {"example.com"},
		"MX":    {},
	}
	data := DNSResponse{URI: "example.com", Region: "ams", WorkspaceID: 42, Records: records}

	event, err := data.tinybirdEvent()
	if err != nil {
		t.Fatalf("tinybirdEvent() error = %v", err)
	}

	b, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("marshal event error = %v", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatalf("unmarshal payload error = %v", err)
	}

	// records must be a JSON string, not an object — otherwise Tinybird
	// auto-flattens it into quarantined records_* columns.
	var recordsField string
	if err := json.Unmarshal(raw["records"], &recordsField); err != nil {
		t.Fatalf("records field is not a JSON string: %s", raw["records"])
	}

	var roundTrip map[string][]string
	if err := json.Unmarshal([]byte(recordsField), &roundTrip); err != nil {
		t.Fatalf("records string is not valid JSON: %v", err)
	}
	if !reflect.DeepEqual(roundTrip, records) {
		t.Errorf("records round-trip = %v, want %v", roundTrip, records)
	}

	// sibling fields survive the embed
	if got := string(raw["uri"]); got != `"example.com"` {
		t.Errorf("uri = %s, want %q", got, "example.com")
	}
	if got := string(raw["workspaceId"]); got != "42" {
		t.Errorf("workspaceId = %s, want 42", got)
	}
}

func TestTinybirdEventNilRecords(t *testing.T) {
	event, err := DNSResponse{URI: "example.com"}.tinybirdEvent()
	if err != nil {
		t.Fatalf("tinybirdEvent() error = %v", err)
	}
	if event.Records != "null" {
		t.Errorf("nil records marshaled to %q, want %q", event.Records, "null")
	}
}

func TestDNSResponseHTTPShapeKeepsObject(t *testing.T) {
	data := DNSResponse{Records: map[string][]string{"A": {"1.2.3.4"}}}

	b, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal error = %v", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatalf("unmarshal error = %v", err)
	}

	// the HTTP response (consumed by the test-DNS flow + assertions) must keep
	// records as an object, not a string.
	if got := raw["records"][0]; got != '{' {
		t.Errorf("HTTP records is not a JSON object: %s", raw["records"])
	}
}
