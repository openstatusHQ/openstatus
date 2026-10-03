package server

import (
	"context"
	"fmt"
	"os"

	sdklog "go.opentelemetry.io/otel/sdk/log"
)

// reportingExporter wraps a log exporter so every failed export batch is
// written to stderr. The OTLP SDK drops export errors silently by default,
// which made an Axiom outage indistinguishable from health.
type reportingExporter struct {
	sdklog.Exporter
}

func (e *reportingExporter) Export(ctx context.Context, records []sdklog.Record) error {
	err := e.Exporter.Export(ctx, records)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to export log records to Axiom: %v (records: %d)\n", err, len(records))
	}
	return err
}

// withReporting wraps an exporter with export-failure reporting.
func withReporting(exporter sdklog.Exporter) sdklog.Exporter {
	return &reportingExporter{Exporter: exporter}
}
