package otel

import (
	"context"
	"errors"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/stdout/stdoutmetric"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func SetupOTelSDK(
	ctx context.Context,
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
		return
	}

	meterProvider, err := newMeterProvider(ctx, res)
	if err != nil {
		handleErr(err)
		return
	}

	shutdownFuncs = append(shutdownFuncs, meterProvider.Shutdown)

	otel.SetMeterProvider(meterProvider)

	return
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
) (*metric.MeterProvider, error) {
	metricExporter, err := stdoutmetric.New(stdoutmetric.WithPrettyPrint())
	if err != nil {
		return nil, err
	}
	grafanaExporter, err := otlpmetrichttp.New(ctx,
		otlpmetrichttp.WithEndpointURL("https://otlp-gateway-prod-eu-west-2.grafana.net/otlp/v1/metrics"),
		// otlpmetrichttp.WithInsecure(),
		otlpmetrichttp.WithHeaders(map[string]string{
			"Authorization": "Basic ",
		}),
	)
	if err != nil {
		return nil, err
	}
	meterProvider := metric.NewMeterProvider(
		metric.WithResource(res),
		metric.WithReader(metric.NewPeriodicReader(metricExporter,
			// Default is 1m. Set to 3s for demonstrative purposes.
			metric.WithInterval(3*time.Second))),
		metric.WithReader(metric.NewPeriodicReader(grafanaExporter,
			metric.WithInterval(3*time.Second))),
	)

	return meterProvider, nil
}
