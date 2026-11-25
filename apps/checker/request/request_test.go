package request_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/openstatushq/openstatus/apps/checker/request"
)

func TestWithRequestID(t *testing.T) {
	t.Run("empty id leaves headers as they are", func(t *testing.T) {
		headers := map[string]string{"a": "b"}
		assert.Equal(t, headers, request.WithRequestID(headers, ""))
		assert.Nil(t, request.WithRequestID(nil, ""))
	})

	t.Run("nil headers are safe", func(t *testing.T) {
		assert.Equal(t, map[string]string{request.RequestIDHeader: "id"}, request.WithRequestID(nil, "id"))
	})

	t.Run("does not change the input", func(t *testing.T) {
		headers := map[string]string{"a": "b"}
		got := request.WithRequestID(headers, "id")
		assert.Equal(t, map[string]string{"a": "b"}, headers)
		assert.Equal(t, map[string]string{"a": "b", request.RequestIDHeader: "id"}, got)
	})

	t.Run("replaces a custom value in any case", func(t *testing.T) {
		got := request.WithRequestID(map[string]string{"X-OpenStatus-Request-ID": "custom"}, "id")
		assert.Equal(t, map[string]string{request.RequestIDHeader: "id"}, got)
	})
}
