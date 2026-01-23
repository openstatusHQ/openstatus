package logs

import (
	"log/slog"
	"math/rand/v2"
	"time"
)

func ShouldSample(event map[string]any) bool {
	statusCode, _ := event["status_code"].(int)
	durationMs, _ := event["duration_ms"].(int)
	// Always capture: server errors
	if statusCode >= 500 {
		return true
	}

	// Always capture: explicit errors
	if _, hasError := event["error"]; hasError {
		return true
	}

	// Always capture: slow requests (above p99 - 2s threshold)
	if durationMs > 2000 {
		return true
	}

	// Higher sampling for client errors (4xx) - 100%
	if statusCode >= 400 && statusCode < 500 {
		return true
	}

	// Random sample successful, fast requests at 20%
	return rand.Float64() < 0.2
}

// MapToAttrs converts a map[string]any to a slice of slog.Attr
func MapToAttrs(m map[string]any) []slog.Attr {
	attrs := make([]slog.Attr, 0, len(m))
	for k, v := range m {
		attrs = append(attrs, toAttr(k, v))
	}
	return attrs
}

func toAttr(key string, value any) slog.Attr {
	switch v := value.(type) {
	case string:
		return slog.String(key, v)
	case int:
		return slog.Int(key, v)
	case int64:
		return slog.Int64(key, v)
	case float64:
		return slog.Float64(key, v)
	case bool:
		return slog.Bool(key, v)
	case time.Time:
		return slog.Time(key, v)
	case time.Duration:
		return slog.Duration(key, v)
	case map[string]any:
		return slog.Group(key, MapToAny(v)...)
	default:
		return slog.Any(key, v)
	}
}

func MapToAny(m map[string]any) []any {
	args := make([]any, 0, len(m)*2)
	for k, v := range m {
		args = append(args, toAttr(k, v))
	}
	return args
}
