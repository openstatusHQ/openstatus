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

// UCUM unit codes, as OpenTelemetry expects them.
const (
	unitMilliseconds = "ms"
	unitPercent      = "%"
)

// recordGauge creates a Float64Gauge for a duration in milliseconds and records
// a value. Use recordGaugeWithUnit for anything that is not a duration —
// backends render a gauge according to its unit, so a mislabelled one is read
// as a time span.
func recordGauge(ctx context.Context, meter metric.Meter, name, description string, value float64, att metric.MeasurementOption) error {
	return recordGaugeWithUnit(ctx, meter, name, description, unitMilliseconds, value, att)
}

// recordGaugeWithUnit creates a Float64Gauge carrying an explicit unit and
// records a value.
func recordGaugeWithUnit(ctx context.Context, meter metric.Meter, name, description, unit string, value float64, att metric.MeasurementOption) error {
	gauge, err := meter.Float64Gauge(name,
		metric.WithDescription(description), metric.WithUnit(unit))
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

func recordStatusCounter(ctx context.Context, meter metric.Meter, att metric.MeasurementOption) {
	counter, err := meter.Int64Counter("openstatus.status", metric.WithDescription("Status of the check"))
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

		recordStatusCounter(ctx, meter, att)

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

func RecordDNSMetrics(ctx context.Context, req request.DNSCheckerRequest, latency int64, isError bool, region string) {
	withMeter(ctx, req.OtelConfig.Endpoint, req.OtelConfig.Headers, func(meter metric.Meter) {
		att := metric.WithAttributes(
			attribute.String("openstatus.probes", region),
			attribute.String("openstatus.target", req.URI),
		)

		if isError {
			recordErrorCounter(ctx, meter, att)
			return
		}

		recordStatusCounter(ctx, meter, att)

		if err := recordGauge(ctx, meter, "openstatus.dns.request.duration", "Duration of the check", float64(latency), att); err != nil {
			log.Ctx(ctx).Error().Err(err).Str("metric", "openstatus.dns.request.duration").Msg("Error creating gauge")
		}
	})
}

func RecordICMPMetrics(ctx context.Context, req request.ICMPCheckerRequest, result checker.ICMPResponse, region string) {
	withMeter(ctx, req.OtelConfig.Endpoint, req.OtelConfig.Headers, func(meter metric.Meter) {
		att := metric.WithAttributes(
			attribute.String("openstatus.probes", region),
			attribute.String("openstatus.target", req.URI),
		)
		recordICMPInstruments(ctx, meter, result, att)
	})
}

// recordICMPInstruments is split out of RecordICMPMetrics so tests can supply a
// collectable meter: withMeter installs a real OTLP provider globally, which
// leaves nothing to assert against.
func recordICMPInstruments(ctx context.Context, meter metric.Meter, result checker.ICMPResponse, att metric.MeasurementOption) {
	if result.Error == 1 {
		recordErrorCounter(ctx, meter, att)
		return
	}

	recordStatusCounter(ctx, meter, att)

	if err := recordGauge(ctx, meter, "openstatus.icmp.request.duration", "Duration of the check", float64(result.Latency), att); err != nil {
		log.Ctx(ctx).Error().Err(err).Str("metric", "openstatus.icmp.request.duration").Msg("Error creating gauge")
	}

	packetLoss := float64(result.PacketsSent-result.PacketsReceived) / float64(result.PacketsSent) * 100
	if err := recordGaugeWithUnit(ctx, meter, "openstatus.icmp.packet.loss", "Packet loss percentage", unitPercent, packetLoss, att); err != nil {
		log.Ctx(ctx).Error().Err(err).Str("metric", "openstatus.icmp.packet.loss").Msg("Error creating gauge")
	}
}

func RecordGRPCMetrics(ctx context.Context, req request.GRPCCheckerRequest, result checker.GRPCResponse, region string) {
	withMeter(ctx, req.OtelConfig.Endpoint, req.OtelConfig.Headers, func(meter metric.Meter) {
		att := metric.WithAttributes(
			attribute.String("openstatus.probes", region),
			attribute.String("openstatus.target", req.URI),
		)
		recordGRPCInstruments(ctx, meter, result, att)
	})
}

// recordGRPCInstruments branches on whether the RPC completed, not on the error
// flag: a NOT_SERVING answer sets the flag but did complete, and gating the
// gauges on the flag would leave openstatus.grpc.serving_status able to emit
// only 1. Split out of RecordGRPCMetrics so tests can supply a collectable meter.
func recordGRPCInstruments(ctx context.Context, meter metric.Meter, result checker.GRPCResponse, att metric.MeasurementOption) {
	if !result.Completed {
		recordErrorCounter(ctx, meter, att)
		return
	}

	gauges := []struct {
		name        string
		description string
		value       float64
	}{
		{"openstatus.grpc.request.duration", "Duration of the check", float64(result.Latency)},
		{"openstatus.grpc.dns.duration", "Duration of the DNS lookup", grpcPhase(result.Timing.DnsStart, result.Timing.DnsDone)},
		{"openstatus.grpc.connection.duration", "Duration of the connection", grpcPhase(result.Timing.ConnectStart, result.Timing.ConnectDone)},
		{"openstatus.grpc.tls.duration", "Duration of the TLS handshake", grpcPhase(result.Timing.TlsHandshakeStart, result.Timing.TlsHandshakeDone)},
		{"openstatus.grpc.ttfb.duration", "Duration of the TTFB", grpcPhase(result.Timing.FirstByteStart, result.Timing.FirstByteDone)},
	}

	for _, g := range gauges {
		if err := recordGauge(ctx, meter, g.name, g.description, g.value, att); err != nil {
			log.Ctx(ctx).Error().Err(err).Str("metric", g.name).Msg("Error creating gauge")
		}
	}

	serving := float64(0)
	if result.ServingStatus == checker.ServingStatusServing {
		serving = 1
	}

	if err := recordGauge(ctx, meter, "openstatus.grpc.serving_status", "Serving status of the target", serving, att); err != nil {
		log.Ctx(ctx).Error().Err(err).Str("metric", "openstatus.grpc.serving_status").Msg("Error creating gauge")
	}

	if serving == 1 {
		recordStatusCounter(ctx, meter, att)
	} else {
		recordErrorCounter(ctx, meter, att)
	}
}

// grpcPhase mirrors calculateTiming: a phase whose hook never fired leaves a
// zero behind, and subtracting absolute epoch stamps would report a huge value.
func grpcPhase(start, done int64) float64 {
	if start == 0 || done == 0 {
		return 0
	}

	return float64(done - start)
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

		recordStatusCounter(ctx, meter, att)

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
