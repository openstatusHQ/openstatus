package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	_ "github.com/joho/godotenv/autoload"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"

	"github.com/openstatushq/openstatus/apps/private-location/internal/database"
	"github.com/openstatushq/openstatus/apps/private-location/internal/logs"
	"github.com/openstatushq/openstatus/apps/private-location/internal/tinybird"
)

type Server struct {
	port        int
	db          *sqlx.DB
	logger      *slog.Logger
	logProvider *sdklog.LoggerProvider
	httpClient  *http.Client
	tbClient    *tinybird.Batcher
}

// instanceID is generated once at startup
var instanceID = uuid.New().String()

// NewServer returns an HTTP server and a cleanup function to shutdown the log provider.
func NewServer() (*http.Server, func(context.Context)) {
	portStr := os.Getenv("PORT")
	if portStr == "" {
		portStr = "8080"
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid PORT value %q: %v\n", portStr, err)
		os.Exit(1)
	}

	logger, logProvider := setupLogger()

	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}
	tbClient := tinybird.NewBatcher(httpClient, os.Getenv("TINYBIRD_TOKEN"), tinybirdOptions())

	newServer := &Server{
		port:        port,
		db:          database.New(),
		logger:      logger,
		logProvider: logProvider,
		httpClient:  httpClient,
		tbClient:    tbClient,
	}

	// Declare Server config
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", newServer.port),
		Handler:      newServer.RegisterRoutes(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// Startup logging
	slog.Info("server starting",
		"port", port,
		"instance_id", instanceID,
		"axiom_configured", os.Getenv("AXIOM_TOKEN") != "",
		"tinybird_configured", os.Getenv("TINYBIRD_TOKEN") != "",
	)

	// Return cleanup function for graceful shutdown
	cleanup := func(ctx context.Context) {
		// Ingests that finished during the HTTP drain may still sit in a batch.
		if err := tbClient.Close(ctx); err != nil {
			slog.Error("failed to flush tinybird batches", "error", err)
		}
		if logProvider != nil {
			logProvider.Shutdown(ctx)
		}
		database.Close()
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

	environment := env("ENVIRONMENT", "production")

	res := resource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceNameKey.String("openstatus-private-location"),
		attribute.String("environment", environment),

		attribute.String("instance_id", instanceID),
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

func tinybirdOptions() tinybird.BatcherOptions {
	opts := tinybird.DefaultBatcherOptions()
	opts.FlushInterval = envDuration("TINYBIRD_FLUSH_INTERVAL", opts.FlushInterval)
	opts.FlushJitter = envDuration("TINYBIRD_FLUSH_JITTER", opts.FlushJitter)
	opts.MaxBytes = envInt("TINYBIRD_MAX_BATCH_BYTES", opts.MaxBytes)
	// The ingest handler waits for its row's flush, so the flush delay plus the
	// retry budget must stay under the server's 30s WriteTimeout.
	opts.RetryBudget = 20 * time.Second
	// A zero budget would expire before the first request.
	if retryBudget := envDuration("TINYBIRD_RETRY_BUDGET", 0); retryBudget > 0 {
		opts.RetryBudget = retryBudget
	}
	opts.OnFlush = logTinybirdFlush

	return opts
}

func logTinybirdFlush(ctx context.Context, e tinybird.FlushEvent) {
	event := map[string]any{
		"timestamp":           time.Now().Format(time.RFC3339),
		"datasource":          e.DataSource,
		"rows":                e.Rows,
		"bytes":               e.Bytes,
		"attempts":            e.Attempts,
		"ambiguous_attempts":  e.AmbiguousAttempts,
		"status_code":         e.StatusCode,
		"duration_ms":         int(e.Duration.Milliseconds()),
		"oldest_wait_ms":      int(e.OldestWait.Milliseconds()),
		"ratelimit_limit":     e.RateLimitLimit,
		"ratelimit_remaining": e.RateLimitRemaining,
	}
	if e.Err != nil {
		event["error"] = map[string]any{
			"type":    "TinybirdFlushError",
			"message": e.Err.Error(),
		}
	}

	if e.Attempts > 1 || logs.ShouldSample(event) {
		slog.LogAttrs(ctx, slog.LevelInfo, "tinybird flush", logs.MapToAttrs(event)...)
	}
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value, err := time.ParseDuration(env(key, ""))
	if err != nil || value < 0 {
		return fallback
	}

	return value
}

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(env(key, ""))
	if err != nil || value <= 0 {
		return fallback
	}

	return value
}
