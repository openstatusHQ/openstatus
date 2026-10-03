package otel

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	sdklog "go.opentelemetry.io/otel/sdk/log"
)

type failingExporter struct{ err error }

func (f failingExporter) Export(context.Context, []sdklog.Record) error { return f.err }
func (f failingExporter) ForceFlush(context.Context) error              { return nil }
func (f failingExporter) Shutdown(context.Context) error                { return nil }

func TestWithReportingPropagatesExportError(t *testing.T) {
	want := errors.New("boom")
	wrapped := WithReporting(failingExporter{err: want})
	err := wrapped.Export(context.Background(), nil)
	require.ErrorIs(t, err, want)
}

func TestWithReportingPassesThroughSuccess(t *testing.T) {
	wrapped := WithReporting(failingExporter{})
	require.NoError(t, wrapped.Export(context.Background(), nil))
}

func TestWithReportingLogsFailure(t *testing.T) {
	var buf bytes.Buffer
	original := log.Logger
	log.Logger = zerolog.New(&buf)
	defer func() { log.Logger = original }()

	wrapped := WithReporting(failingExporter{err: errors.New("boom")})
	_ = wrapped.Export(context.Background(), nil)

	assert.Contains(t, buf.String(), "failed to export log records to Axiom")
}
