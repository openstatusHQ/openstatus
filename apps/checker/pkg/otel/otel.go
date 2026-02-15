package otel

import (
	"context"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/metric"
	sdkMetrics "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"

	semconv "go.opentelemetry.io/otel/semconv/v1.39.0"
)

func setupOTelSDK(ctx context.Context, url string, headers map[string]string) (shutdown func(context.Context) error, err error) {
	res, err := newResource()
	if err != nil {
		return nil, err
	}

	meterProvider, err := newMeterProvider(ctx, res, url, headers)
	if err != nil {
		return nil, err
	}

	otel.SetMeterProvider(meterProvider)

	return meterProvider.Shutdown, nil
}

func newResource() (*resource.Resource, error) {
	return resource.Merge(resource.Default(),
		resource.NewWithAttributes(semconv.SchemaURL,
			semconv.ServiceName("openstatus-synthetic-check"),
			semconv.ServiceVersion("0.1.0"),
		))
}

func newMeterProvider(
	ctx context.Context,
	res *resource.Resource,
	url string,
	headers map[string]string,
) (*sdkMetrics.MeterProvider, error) {
	exporter, err := otlpmetrichttp.New(ctx,
		otlpmetrichttp.WithEndpointURL(url),
		otlpmetrichttp.WithHeaders(headers),
	)
	if err != nil {
		return nil, err
	}

	return sdkMetrics.NewMeterProvider(
		sdkMetrics.WithResource(res),
		sdkMetrics.WithReader(sdkMetrics.NewPeriodicReader(exporter,
			sdkMetrics.WithInterval(3*time.Second))),
	), nil
}

// withMeter sets up the OTel SDK, passes a Meter to the callback, then shuts down.
func withMeter(ctx context.Context, endpoint string, headers map[string]string, fn func(metric.Meter)) {
	shutdown, err := setupOTelSDK(ctx, endpoint, headers)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("Error setting up otel")
		return
	}

	defer func() {
		if err := shutdown(ctx); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("Error shutting down otel")
		}
	}()

	fn(otel.Meter("OpenStatus"))
}

// recordGauge creates a Float64Gauge and records a value.
func recordGauge(ctx context.Context, meter metric.Meter, name, description string, value float64, att metric.MeasurementOption) error {
	gauge, err := meter.Float64Gauge(name,
		metric.WithDescription(description), metric.WithUnit("ms"))
	if err != nil {
		return err
	}

	gauge.Record(ctx, value, att)

	return nil
}

func recordErrorCounter(ctx context.Context, meter metric.Meter, att metric.MeasurementOption) {
	counter, err := meter.Int64Counter("openstatus.error", metric.WithDescription("Status of the check"))
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("Error setting up counter")
		return
	}

	counter.Add(ctx, 1, att)
}

func RecordHTTPMetrics(ctx context.Context, req request.HttpCheckerRequest, result checker.Response, region string) {
	withMeter(ctx, req.OtelConfig.Endpoint, req.OtelConfig.Headers, func(meter metric.Meter) {
		att := metric.WithAttributes(
			attribute.String("openstatus.probes", region),
			attribute.String("openstatus.target", req.URL),
			semconv.HTTPResponseStatusCode(result.Status),
		)

		if result.Error != "" {
			recordErrorCounter(ctx, meter, att)
			return
		}

		status, err := meter.Int64Counter("openstatus.status", metric.WithDescription("Status of the check"))
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("Error setting up counter")
		}

		status.Add(ctx, 1, att)

		timings := []struct {
			name        string
			description string
			value       float64
		}{
			{"openstatus.http.request.duration", "Duration of the check", float64(result.Latency)},
			{"openstatus.http.dns.duration", "Duration of the DNS lookup", float64(result.Timing.DnsDone - result.Timing.DnsStart)},
			{"openstatus.http.connection.duration", "Duration of the connection", float64(result.Timing.ConnectDone - result.Timing.ConnectStart)},
			{"openstatus.http.tls.duration", "Duration of the TLS handshake", float64(result.Timing.TlsHandshakeDone - result.Timing.TlsHandshakeStart)},
			{"openstatus.http.ttfb.duration", "Duration of the TTFB", float64(result.Timing.FirstByteDone - result.Timing.FirstByteStart)},
			{"openstatus.http.transfer.duration", "Duration of the transfer", float64(result.Timing.TransferDone - result.Timing.TransferStart)},
		}

		for _, t := range timings {
			if err := recordGauge(ctx, meter, t.name, t.description, t.value, att); err != nil {
				log.Ctx(ctx).Error().Err(err).Str("metric", t.name).Msg("Error creating gauge")
			}
		}
	})
}

func RecordTCPMetrics(ctx context.Context, req request.TCPCheckerRequest, result checker.TCPResponse, region string) {
	withMeter(ctx, req.OtelConfig.Endpoint, req.OtelConfig.Headers, func(meter metric.Meter) {
		att := metric.WithAttributes(
			attribute.String("openstatus.probes", region),
			attribute.String("openstatus.target", req.URI),
		)

		if result.Error == 1 {
			recordErrorCounter(ctx, meter, att)
			return
		}

		timings := []struct {
			name        string
			description string
			value       float64
		}{
			{"openstatus.tcp.request.duration", "Duration of the check", float64(result.Latency)},
			{"openstatus.tcp.tcp.duration", "Duration of the TCP connection", float64(result.Timing.TCPDone - result.Timing.TCPStart)},
		}

		for _, t := range timings {
			if err := recordGauge(ctx, meter, t.name, t.description, t.value, att); err != nil {
				log.Ctx(ctx).Error().Err(err).Str("metric", t.name).Msg("Error creating gauge")
			}
		}
	})
}
