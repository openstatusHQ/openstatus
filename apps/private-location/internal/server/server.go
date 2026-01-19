package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/joho/godotenv/autoload"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.16.0"

	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
)

type Server struct {
	port        int
	db          *sqlx.DB
	logger      *slog.Logger
	logProvider *sdklog.LoggerProvider
}

// NewServer returns an HTTP server and a cleanup function to shutdown the log provider.
func NewServer() (*http.Server, func(context.Context)) {
	port, _ := strconv.Atoi(os.Getenv("PORT"))

	logger, logProvider := setupLogger()

	newServer := &Server{
		port:        port,
		db:          database.New(),
		logger:      logger,
		logProvider: logProvider,
	}

	// Declare Server config
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", newServer.port),
		Handler:      newServer.RegisterRoutes(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// Return cleanup function for graceful shutdown
	cleanup := func(ctx context.Context) {
		if logProvider != nil {
			logProvider.Shutdown(ctx)
		}
	}

	return server, cleanup
}

func setupLogger() (*slog.Logger, *sdklog.LoggerProvider) {
	ctx := context.Background()

	axiomToken := env("AXIOM_TOKEN", "")
	axiomDataset := env("AXIOM_DATASET", "dev")

	// If no Axiom token, return a standard logger
	if axiomToken == "" {
		logger := slog.Default()
		return logger, nil
	}

	res := resource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceNameKey.String("openstatus-private-location"),
		semconv.ServiceVersionKey.String("1.0.0"),
		attribute.String("environment", "production"),
	)

	// Set up OTLP log exporter for Axiom
	exporter, err := otlploghttp.New(ctx,
		otlploghttp.WithEndpointURL("https://eu-central-1.aws.edge.axiom.co/v1/logs"),
		otlploghttp.WithHeaders(map[string]string{
			"Authorization":   "Bearer " + axiomToken,
			"X-Axiom-Dataset": axiomDataset,
		}),
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create OTLP exporter: %v\n", err)
		return slog.Default(), nil
	}

	// Create log provider with resource and batch processor
	logProvider := sdklog.NewLoggerProvider(
		sdklog.WithResource(res),
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
	)

	global.SetLoggerProvider(logProvider)
	logger := otelslog.NewLogger("openstatus-private-location")
	slog.SetDefault(logger)

	return logger, logProvider
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
