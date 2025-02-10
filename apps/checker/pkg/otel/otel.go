package otel

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/metric"
	sdkMetrics "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"

	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func SetupOTelSDK(
	ctx context.Context, url string, probes string, headers map[string]string,
) (shutdown func(context.Context) error, err error) {
	var shutdownFuncs []func(context.Context) error

	shutdown = func(ctx context.Context) error {
		var err error

		for _, fn := range shutdownFuncs {
			err = errors.Join(err, fn(ctx))
		}

		shutdownFuncs = nil

		return err
	}

	handleErr := func(inErr error) {
		err = errors.Join(inErr, shutdown(ctx))
	}

	res, err := newResource()
	if err != nil {
		handleErr(err)

		return nil, err
	}

	meterProvider, err := newMeterProvider(ctx, res, url, headers)
	if err != nil {
		handleErr(err)

		return nil, err
	}

	shutdownFuncs = append(shutdownFuncs, meterProvider.Shutdown)

	otel.SetMeterProvider(meterProvider)

	return shutdown, nil
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

	grafanaExporter, err := otlpmetrichttp.New(ctx,
		otlpmetrichttp.WithEndpointURL(url),
		// otlpmetrichttp.WithInsecure(),
		otlpmetrichttp.WithHeaders(headers),
	)
	if err != nil {
		return nil, err
	}

	meterProvider := sdkMetrics.NewMeterProvider(
		sdkMetrics.WithResource(res),

		sdkMetrics.WithReader(sdkMetrics.NewPeriodicReader(grafanaExporter,
			sdkMetrics.WithInterval(3*time.Second))),
	)

	return meterProvider, nil
}

func RecordHTTPMetrics(ctx context.Context, req request.HttpCheckerRequest, result checker.Response, region string) {

	otelShutdown, err := SetupOTelSDK(ctx, req.OtelConfig.Endpoint, region, req.OtelConfig.Headers)

	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("Error setting up otel")
	}

	defer func() {
		err = errors.Join(err, otelShutdown(ctx))
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("Error sending the data")
		}
	}()

	meter := otel.Meter("OpenStatus")

	if result.Error != "" {
		att := metric.WithAttributes(
			attribute.String("openstatus.probes", region),
			attribute.String("openstatus.target", req.URL),
			semconv.HTTPResponseStatusCode(result.Status),
		)
		statusError, err := meter.Int64Counter("openstatus.error", metric.WithDescription("Status of the check"))

		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("Error setting up counter")
		}

		statusError.Add(ctx, (1), att)

		return
	}

	att := metric.WithAttributes(
		attribute.String("openstatus.probes", region),
		attribute.String("openstatus.target", req.URL),
		semconv.HTTPResponseStatusCode(result.Status),
	)

	status, err := meter.Int64Counter("openstatus.status", metric.WithDescription("Status of the check"))

	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("Error setting up conunter")
	}

	status.Add(ctx, 1, att)

	gauge, err := meter.Float64Gauge("openstatus.http.request.duration",
		metric.WithDescription("Duration of the check"), metric.WithUnit("ms"))

	if err != nil {
		fmt.Println("Error creating gauge", err)
	}

	gauge.Record(ctx, float64(result.Latency), att)

	gaugeDns, err := meter.Float64Gauge("openstatus.http.dns.duration",
		metric.WithDescription("Duration of the dns lookup"), metric.WithUnit("ms"))

	if err != nil {
		fmt.Println("Error creating gauge", err)
	}

	gaugeDns.Record(ctx, float64(result.Timing.DnsDone-result.Timing.DnsStart), att)

	gaugeConnect, err := meter.Float64Gauge("openstatus.http.connection.duration",
		metric.WithDescription("Duration of the connection"), metric.WithUnit("ms"))

	if err != nil {
		fmt.Println("Error creating gauge", err)
	}

	gaugeConnect.Record(ctx, float64(result.Timing.ConnectDone-result.Timing.ConnectStart), att)

	gaugeTLS, err := meter.Float64Gauge("openstatus.http.tls.duration",
		metric.WithDescription("Duration of the tls handshake"), metric.WithUnit("ms"))

	if err != nil {
		fmt.Println("Error creating gauge", err)
	}

	gaugeTLS.Record(ctx, float64(result.Timing.TlsHandshakeDone-result.Timing.TlsHandshakeStart), att)

	gaugeTTFB, err := meter.Float64Gauge("openstatus.http.ttfb.duration",
		metric.WithDescription("Duration of the ttfb"), metric.WithUnit("ms"))

	if err != nil {
		fmt.Println("Error creating gauge", err)
	}

	gaugeTTFB.Record(ctx, float64(result.Timing.FirstByteDone-result.Timing.FirstByteStart), att)

	gaugeTransfer, err := meter.Float64Gauge("openstatus.http.transfer.duration",
		metric.WithDescription("Duration of the transfer"), metric.WithUnit("ms"))

	if err != nil {
		fmt.Println("Error creating gauge", err)
	}

	gaugeTransfer.Record(ctx, float64(result.Timing.TransferDone-result.Timing.TransferStart), att)
}

func RecordTCPMetrics(ctx context.Context, req request.TCPCheckerRequest, result checker.TCPResponse, region string) {

	otelShutdown, err := SetupOTelSDK(ctx, req.OtelConfig.Endpoint, region, req.OtelConfig.Headers)

	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("Error setting up otel")
	}

	defer func() {
		err = errors.Join(err, otelShutdown(ctx))
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("Error sending the data")
		}
	}()

	meter := otel.Meter("OpenStatus")

	if result.Error == 1 {
		att := metric.WithAttributes(
			attribute.String("openstatus.probes", region),
			attribute.String("openstatus.target", req.URI),
		)
		statusError, err := meter.Int64Counter("openstatus.error", metric.WithDescription("Status of the check"))

		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("Error setting up counter")
		}

		statusError.Add(ctx, (1), att)

		return
	}

	att := metric.WithAttributes(
		attribute.String("openstatus.probes", region),
		attribute.String("openstatus.target", req.URI),
	)

	gauge, err := meter.Float64Gauge("openstatus.tcp.request.duration",
		metric.WithDescription("Duration of the check"), metric.WithUnit("ms"))

	if err != nil {
		fmt.Println("Error creating gauge", err)
	}

	gauge.Record(ctx, float64(result.Latency), att)

	gaugeTCP, err := meter.Float64Gauge("openstatus.tcp.tcp.duration",
		metric.WithDescription("Duration of the dns lookup"), metric.WithUnit("ms"))

	if err != nil {
		fmt.Println("Error creating gauge", err)
	}

	gaugeTCP.Record(ctx, float64(result.Timing.TCPDone-result.Timing.TCPStart), att)

}
