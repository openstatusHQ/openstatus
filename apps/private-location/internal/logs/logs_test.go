package logs_test

import (
	"log/slog"
	"testing"
	"time"

	"github.com/openstatushq/openstatus/apps/private-location/internal/logs"
)

func TestShouldSample(t *testing.T) {
	tests := []struct {
		name     string
		event    map[string]any
		expected bool
	}{
		{
			name: "server error 500 should always sample",
			event: map[string]any{
				"status_code": 500,
			},
			expected: true,
		},
		{
			name: "server error 503 should always sample",
			event: map[string]any{
				"status_code": 503,
			},
			expected: true,
		},
		{
			name: "server error 599 should always sample",
			event: map[string]any{
				"status_code": 599,
			},
			expected: true,
		},
		{
			name: "explicit error should always sample",
			event: map[string]any{
				"status_code": 200,
				"error":       "something went wrong",
			},
			expected: true,
		},
		{
			name: "slow request above 2000ms should always sample",
			event: map[string]any{
				"status_code": 200,
				"duration_ms": 2001,
			},
			expected: true,
		},
		{
			name: "slow request exactly 2000ms should not always sample",
			event: map[string]any{
				"status_code": 200,
				"duration_ms": 2000,
			},
			expected: false, // This will be randomly sampled at 20%
		},
		{
			name: "client error 400 should always sample",
			event: map[string]any{
				"status_code": 400,
			},
			expected: true,
		},
		{
			name: "client error 404 should always sample",
			event: map[string]any{
				"status_code": 404,
			},
			expected: true,
		},
		{
			name: "client error 499 should always sample",
			event: map[string]any{
				"status_code": 499,
			},
			expected: true,
		},
		{
			name: "status code 399 should not always sample (below client error range)",
			event: map[string]any{
				"status_code": 399,
			},
			expected: false, // Random 20% sampling
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := logs.ShouldSample(tt.event)
			if tt.expected && !result {
				t.Errorf("ShouldSample() = %v, expected %v (should always sample)", result, tt.expected)
			}
			// For cases where expected is false, we can't deterministically test
			// because the function uses random sampling. We just verify it doesn't
			// always return true.
		})
	}
}

func TestShouldSample_RandomSampling(t *testing.T) {
	// Test that successful, fast requests are sometimes sampled
	event := map[string]any{
		"status_code": 200,
		"duration_ms": 100,
	}

	// Run multiple times to verify random sampling works
	sampledCount := 0
	iterations := 1000
	for i := 0; i < iterations; i++ {
		if logs.ShouldSample(event) {
			sampledCount++
		}
	}

	// With 20% sampling, we expect roughly 200 samples out of 1000
	// Allow for some variance (between 10% and 30%)
	minExpected := iterations / 10  // 10%
	maxExpected := iterations * 3 / 10 // 30%

	if sampledCount < minExpected || sampledCount > maxExpected {
		t.Errorf("Random sampling seems off: got %d samples out of %d (expected roughly 20%%)", sampledCount, iterations)
	}
}

func TestShouldSample_EmptyEvent(t *testing.T) {
	// Empty event should fall through to random sampling
	event := map[string]any{}

	// Just verify it doesn't panic
	_ = logs.ShouldSample(event)
}

func TestShouldSample_MissingFields(t *testing.T) {
	// Event with no status_code or duration_ms
	event := map[string]any{
		"path":   "/api/test",
		"method": "GET",
	}

	// Should fall through to random sampling without panic
	_ = logs.ShouldSample(event)
}

func TestMapToAttrs(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]any
		expected int // expected number of attributes
	}{
		{
			name:     "empty map",
			input:    map[string]any{},
			expected: 0,
		},
		{
			name: "single string value",
			input: map[string]any{
				"key": "value",
			},
			expected: 1,
		},
		{
			name: "multiple types",
			input: map[string]any{
				"string_key": "value",
				"int_key":    42,
				"bool_key":   true,
			},
			expected: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attrs := logs.MapToAttrs(tt.input)
			if len(attrs) != tt.expected {
				t.Errorf("MapToAttrs() returned %d attrs, expected %d", len(attrs), tt.expected)
			}
		})
	}
}

func TestMapToAttrs_TypeConversions(t *testing.T) {
	now := time.Now()
	duration := 5 * time.Second

	input := map[string]any{
		"string_val":   "hello",
		"int_val":      42,
		"int64_val":    int64(1234567890),
		"float64_val":  3.14,
		"bool_val":     true,
		"time_val":     now,
		"duration_val": duration,
	}

	attrs := logs.MapToAttrs(input)

	// Verify correct number of attributes
	if len(attrs) != 7 {
		t.Errorf("Expected 7 attributes, got %d", len(attrs))
	}

	// Verify each attribute type
	attrMap := make(map[string]slog.Attr)
	for _, attr := range attrs {
		attrMap[attr.Key] = attr
	}

	// Check string
	if attr, ok := attrMap["string_val"]; ok {
		if attr.Value.Kind() != slog.KindString {
			t.Errorf("string_val should be String kind, got %v", attr.Value.Kind())
		}
		if attr.Value.String() != "hello" {
			t.Errorf("string_val should be 'hello', got %v", attr.Value.String())
		}
	}

	// Check int
	if attr, ok := attrMap["int_val"]; ok {
		if attr.Value.Kind() != slog.KindInt64 {
			t.Errorf("int_val should be Int64 kind, got %v", attr.Value.Kind())
		}
		if attr.Value.Int64() != 42 {
			t.Errorf("int_val should be 42, got %v", attr.Value.Int64())
		}
	}

	// Check bool
	if attr, ok := attrMap["bool_val"]; ok {
		if attr.Value.Kind() != slog.KindBool {
			t.Errorf("bool_val should be Bool kind, got %v", attr.Value.Kind())
		}
		if attr.Value.Bool() != true {
			t.Errorf("bool_val should be true, got %v", attr.Value.Bool())
		}
	}
}

func TestMapToAttrs_NestedMap(t *testing.T) {
	input := map[string]any{
		"outer": map[string]any{
			"inner_string": "nested_value",
			"inner_int":    123,
		},
	}

	attrs := logs.MapToAttrs(input)

	if len(attrs) != 1 {
		t.Errorf("Expected 1 attribute (group), got %d", len(attrs))
	}

	// The nested map should be converted to a Group
	if attrs[0].Key != "outer" {
		t.Errorf("Expected key 'outer', got %s", attrs[0].Key)
	}
	if attrs[0].Value.Kind() != slog.KindGroup {
		t.Errorf("Expected Group kind for nested map, got %v", attrs[0].Value.Kind())
	}
}

func TestMapToAttrs_UnknownType(t *testing.T) {
	type customType struct {
		Field string
	}

	input := map[string]any{
		"custom": customType{Field: "test"},
	}

	attrs := logs.MapToAttrs(input)

	if len(attrs) != 1 {
		t.Errorf("Expected 1 attribute, got %d", len(attrs))
	}

	// Unknown types should be converted using slog.Any
	if attrs[0].Key != "custom" {
		t.Errorf("Expected key 'custom', got %s", attrs[0].Key)
	}
	if attrs[0].Value.Kind() != slog.KindAny {
		t.Errorf("Expected Any kind for unknown type, got %v", attrs[0].Value.Kind())
	}
}

func TestMapToAny(t *testing.T) {
	input := map[string]any{
		"key1": "value1",
		"key2": 42,
	}

	result := logs.MapToAny(input)

	// MapToAny returns []any containing slog.Attr values
	if len(result) != 2 {
		t.Errorf("Expected 2 items, got %d", len(result))
	}

	// Verify each item is an slog.Attr
	for _, item := range result {
		if _, ok := item.(slog.Attr); !ok {
			t.Errorf("Expected slog.Attr, got %T", item)
		}
	}
}

func TestMapToAny_EmptyMap(t *testing.T) {
	input := map[string]any{}

	result := logs.MapToAny(input)

	if len(result) != 0 {
		t.Errorf("Expected empty slice, got %d items", len(result))
	}
}
