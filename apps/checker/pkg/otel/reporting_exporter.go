package otel

import (
	"context"

	"github.com/rs/zerolog/log"

	sdklog "go.opentelemetry.io/otel/sdk/log"
)

// reportingExporter wraps a log exporter so every failed export batch is
// logged through zerolog. The OTLP SDK drops export errors silently by
// default, which made an Axiom outage indistinguishable from health.
type reportingExporter struct {
	sdklog.Exporter
}

func (e *reportingExporter) Export(ctx context.Context, records []sdklog.Record) error {
	err := e.Exporter.Export(ctx, records)
	if err != nil {
		log.Error().Err(err).Int("records", len(records)).Msg("failed to export log records to Axiom")
	}
	return err
}

// WithReporting wraps an exporter with export-failure logging.
func WithReporting(exporter sdklog.Exporter) sdklog.Exporter {
	return &reportingExporter{Exporter: exporter}
}
