package server

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestTinybirdOptions(t *testing.T) {
	t.Run("it should keep the retry budget under the server WriteTimeout by default", func(t *testing.T) {
		opts := tinybirdOptions()

		require.Equal(t, 20*time.Second, opts.RetryBudget)
		require.Less(t, opts.FlushInterval+opts.FlushJitter+opts.RetryBudget, writeTimeout)
		require.NotNil(t, opts.OnFlush)
	})

	t.Run("it should read overrides from the environment", func(t *testing.T) {
		t.Setenv("TINYBIRD_FLUSH_INTERVAL", "500ms")
		t.Setenv("TINYBIRD_FLUSH_JITTER", "0s")
		t.Setenv("TINYBIRD_MAX_BATCH_BYTES", "1024")
		t.Setenv("TINYBIRD_RETRY_BUDGET", "5s")

		opts := tinybirdOptions()

		require.Equal(t, 500*time.Millisecond, opts.FlushInterval)
		require.Zero(t, opts.FlushJitter)
		require.Equal(t, 1024, opts.MaxBytes)
		require.Equal(t, 5*time.Second, opts.RetryBudget)
	})

	t.Run("it should clamp a retry budget override to fit the WriteTimeout", func(t *testing.T) {
		t.Setenv("TINYBIRD_FLUSH_INTERVAL", "2s")
		t.Setenv("TINYBIRD_FLUSH_JITTER", "1s")
		t.Setenv("TINYBIRD_RETRY_BUDGET", "1m")

		opts := tinybirdOptions()

		require.Equal(t, 26*time.Second, opts.RetryBudget)
		require.Less(t, opts.FlushInterval+opts.FlushJitter+opts.RetryBudget, writeTimeout)
	})

	t.Run("it should ignore invalid or non-positive overrides", func(t *testing.T) {
		defaults := tinybirdOptions()
		t.Setenv("TINYBIRD_FLUSH_INTERVAL", "soon")
		t.Setenv("TINYBIRD_FLUSH_JITTER", "-1s")
		t.Setenv("TINYBIRD_MAX_BATCH_BYTES", "0")
		t.Setenv("TINYBIRD_RETRY_BUDGET", "0s")

		opts := tinybirdOptions()

		require.Equal(t, defaults.FlushInterval, opts.FlushInterval)
		require.Equal(t, defaults.FlushJitter, opts.FlushJitter)
		require.Equal(t, defaults.MaxBytes, opts.MaxBytes)
		require.Equal(t, defaults.RetryBudget, opts.RetryBudget)
	})
}

func TestTinybirdToken(t *testing.T) {
	t.Run("it should prefer TINYBIRD_TOKEN when set", func(t *testing.T) {
		t.Setenv("TINYBIRD_TOKEN", "token-from-tinybird-token")
		t.Setenv("TINY_BIRD_API_KEY", "key-from-api-key")

		require.Equal(t, "token-from-tinybird-token", tinybirdToken())
	})

	t.Run("it should fall back to TINY_BIRD_API_KEY when TINYBIRD_TOKEN is empty", func(t *testing.T) {
		t.Setenv("TINYBIRD_TOKEN", "")
		t.Setenv("TINY_BIRD_API_KEY", "key-from-api-key")

		require.Equal(t, "key-from-api-key", tinybirdToken())
	})

	t.Run("it should fall back to TINY_BIRD_API_KEY when TINYBIRD_TOKEN is unset", func(t *testing.T) {
		t.Setenv("TINY_BIRD_API_KEY", "key-from-api-key")

		require.Equal(t, "key-from-api-key", tinybirdToken())
	})

	t.Run("it should return empty string when neither is set", func(t *testing.T) {
		t.Setenv("TINYBIRD_TOKEN", "")
		t.Setenv("TINY_BIRD_API_KEY", "")

		require.Equal(t, "", tinybirdToken())
	})
}
