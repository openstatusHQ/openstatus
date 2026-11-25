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
