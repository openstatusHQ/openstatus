package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"cloud.google.com/go/pubsub/v2"
	"google.golang.org/api/option"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openstatushq/openstatus/apps/checker/handlers"

	"github.com/openstatushq/openstatus/apps/checker/pkg/gcp"
	"github.com/openstatushq/openstatus/apps/checker/pkg/logger"
	"github.com/openstatushq/openstatus/apps/checker/pkg/queue"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	// otelz "go.opentelemetry.io/contrib/bridges/otelzerolog"
	"go.opentelemetry.io/otel/attribute"
	otlploghttp "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.41.0"
)

func shouldSample(event map[string]any) bool {
	statusCode, _ := event["status_code"].(int)
	durationMs, _ := event["duration_ms"].(int)

	// Always capture: server errors
	if statusCode >= 500 {
		return true
	}

	// Always capture: explicit errors
	if _, hasError := event["error"]; hasError {
		return true
	}

	// Always capture: slow requests (above p99 - 2s threshold)
	if durationMs > 2000 {
		return true
	}

	// Higher sampling for client errors (4xx) - 100%
	if statusCode >= 400 && statusCode < 500 {
		return true
	}

	// Random sample successful, fast requests at 20%
	return rand.Float64() < 0.2
}

// MapToAttrs converts a map[string]any to a slice of slog.Attr
func MapToAttrs(m map[string]any) []slog.Attr {
	attrs := make([]slog.Attr, 0, len(m))
	for k, v := range m {
		attrs = append(attrs, toAttr(k, v))
	}
	return attrs
}

func toAttr(key string, value any) slog.Attr {
	switch v := value.(type) {
	case string:
		return slog.String(key, v)
	case int:
		return slog.Int(key, v)
	case int64:
		return slog.Int64(key, v)
	case float64:
		return slog.Float64(key, v)
	case bool:
		return slog.Bool(key, v)
	case time.Time:
		return slog.Time(key, v)
	case time.Duration:
		return slog.Duration(key, v)
	case map[string]any:
		return slog.Group(key, mapToAny(v)...)
	default:
		return slog.Any(key, v)
	}
}

func mapToAny(m map[string]any) []any {
	args := make([]any, 0, len(m)*2)
	for k, v := range m {
		args = append(args, toAttr(k, v))
	}
	return args
}

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		// Generate or get request ID
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("requestId", requestID)

		// Build wide event context at request start
		event := map[string]any{
			"timestamp":    startTime.Format(time.RFC3339),
			"request_id":   requestID,
			"method":       c.Request.Method,
			"path":         c.Request.URL.Path,
			"url":          c.Request.Host + c.Request.URL.String(),
			"user_agent":   c.GetHeader("User-Agent"),
			"content_type": c.GetHeader("Content-Type"),
		}
		c.Set("event", event)

		// Process request
		c.Next()

		// After request - capture response details
		duration := time.Since(startTime).Milliseconds()
		status := c.Writer.Status()

		event["status_code"] = status
		event["duration_ms"] = int(duration)

		// var requestErr error
		if len(c.Errors) > 0 {
			event["outcome"] = "error"
			lastErr := c.Errors.Last()
			event["error"] = map[string]any{
				"type":    "GinError",
				"message": lastErr.Error(),
			}
		} else {
			event["outcome"] = "success"
		}

		if shouldSample(event) {
			attrs := MapToAttrs(event)
			slog.LogAttrs(c.Request.Context(), slog.LevelInfo, "request done", attrs...)
		}

		log.Debug().
			Int("status_code", status).
			Int64("duration_ms", duration).
			Str("request_id", requestID).
			Msg("Request completed")
	}
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Best-effort: allow unprivileged ICMP datagram sockets across all GIDs so
	// PingICMP can avoid the raw-socket fallback. Ignored if not writable.
	if err := os.WriteFile("/proc/sys/net/ipv4/ping_group_range", []byte("0 2147483647"), 0644); err != nil {
		log.Warn().Err(err).Msg("could not widen ping_group_range; icmp will use the raw-socket fallback")
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-done
		cancel()
	}()

	// environment variables.
	var region string
	cronSecret := env("CRON_SECRET", "")
	tinyBirdToken := env("TINYBIRD_TOKEN", "")
	logLevel := env("LOG_LEVEL", "info")
	cloudProvider := env("CLOUD_PROVIDER", "fly")
	axiomToken := env("AXIOM_TOKEN", "")
	axiomDataset := env("AXIOM_DATASET", "dev")
	switch cloudProvider {
	case "fly":
		region = env("FLY_REGION", env("REGION", "local"))

	case "koyeb":
		region = fmt.Sprintf("koyeb_%s", env("KOYEB_REGION", env("REGION", "local")))

	case "railway":
		region = fmt.Sprintf("railway_%s", env("RAILWAY_REPLICA_REGION", env("REGION", "local")))
	default:
		log.Fatal().Msgf("unsupported cloud provider: %s", cloudProvider)
	}
	logger.Configure(logLevel)

	// Define resource with service name, version, and environment
	res := resource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceNameKey.String("openstatus-checker"),
		semconv.ServiceVersionKey.String("1.0.0"),
		attribute.String("environment", "production"),
		attribute.String("cloud.provider", cloudProvider),
		attribute.String("cloud.region", region),
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
		log.Fatal().Err(err).Msg("failed to create OTLP exporter")
	}

	// Create log provider with resource and batch processor
	logProvider := sdklog.NewLoggerProvider(
		sdklog.WithResource(res),
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
	)
	defer logProvider.Shutdown(ctx)

	global.SetLoggerProvider(logProvider)
	slog.SetDefault(otelslog.NewLogger("openstatus-checker"))
	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}

	defer httpClient.CloseIdleConnections()

	tinybirdOptions := tinybird.DefaultBatcherOptions()
	tinybirdOptions.FlushInterval = envDuration("TINYBIRD_FLUSH_INTERVAL", tinybirdOptions.FlushInterval)
	tinybirdOptions.FlushJitter = envDuration("TINYBIRD_FLUSH_JITTER", tinybirdOptions.FlushJitter)
	tinybirdOptions.MaxBytes = envInt("TINYBIRD_MAX_BATCH_BYTES", tinybirdOptions.MaxBytes)
	tinybirdOptions.RetryBudget = envDuration("TINYBIRD_RETRY_BUDGET", tinybirdOptions.RetryBudget)
	tinybirdOptions.OnFlush = logTinybirdFlush
	tinybirdClient := tinybird.NewBatcher(httpClient, tinyBirdToken, tinybirdOptions)

	h := &handlers.Handler{
		Secret:        cronSecret,
		CloudProvider: cloudProvider,
		Region:        region,
		TbClient:      tinybirdClient,
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(Logger())
	router.POST("/checker", h.HTTPCheckerHandler)
	router.POST("/checker/http", h.HTTPCheckerHandler)
	router.POST("/checker/tcp", h.TCPHandler)
	router.POST("/checker/dns", h.DNSHandler)
	router.POST("/checker/icmp", h.ICMPHandler)
	router.POST("/checker/grpc", h.GRPCHandler)
	router.POST("/ping/:region", h.PingRegionHandler)
	router.POST("/tcp/:region", h.TCPHandlerRegion)
	router.POST("/dns/:region", h.DNSHandlerRegion)
	router.POST("/icmp/:region", h.ICMPHandlerRegion)
	router.POST("/grpc/:region", h.GRPCHandlerRegion)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong", "region": region, "provider": cloudProvider})
	})

	httpServer := &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%s", env("PORT", "8080")),
		Handler: router,
	}

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Ctx(ctx).Error().Err(err).Msg("failed to start http server")
			cancel()
		}
	}()

	consumerDone := make(chan struct{})
	if env("PUBSUB_ENABLED", "false") == "true" {
		go func() {
			defer close(consumerDone)
			if err := runConsumer(ctx, h, region); err != nil {
				log.Error().Err(err).Msg("pubsub consumer stopped")
			}
			// A consumer that stopped while the process keeps serving /health
			// would never be restarted, so take the whole process down.
			cancel()
		}()
	} else {
		close(consumerDone)
	}

	<-ctx.Done()
	// The consumer drains on its own from ctx; stop the listener alongside it.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), consumerDrain)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to shutdown http server")
	}
	<-consumerDone

	// Checks that finished during the drain may still sit in a batch.
	flushCtx, flushCancel := context.WithTimeout(context.Background(), tinybirdFinalFlush)
	defer flushCancel()
	if err := tinybirdClient.Close(flushCtx); err != nil {
		log.Error().Err(err).Msg("failed to flush tinybird batches")
	}
}

// tinybirdFinalFlush fits in what the 60s fly kill_timeout leaves after consumerDrain.
const tinybirdFinalFlush = 8 * time.Second

// consumerDrain stays under the 60s fly kill_timeout, so unfinished checks are
// nacked for redelivery before the machine is killed.
const consumerDrain = 50 * time.Second

func runConsumer(ctx context.Context, h *handlers.Handler, region string) error {
	creds, err := gcp.Credentials()
	if err != nil {
		return err
	}

	client, err := pubsub.NewClient(context.Background(), env("GCP_PROJECT_ID", ""), option.WithAuthCredentials(creds))
	if err != nil {
		return fmt.Errorf("creating pubsub client: %w", err)
	}
	defer client.Close()

	consumer := &queue.Consumer{
		Client: client,
		Runner: h,
		Loops: []queue.Loop{
			{
				Subscription:   queue.Subscription(region, false),
				MaxOutstanding: envInt("PUBSUB_MAX_OUTSTANDING", 500),
			},
			{
				Subscription:   queue.Subscription(region, true),
				MaxOutstanding: envInt("PUBSUB_30S_MAX_OUTSTANDING", 2000),
				MaxConcurrent:  envInt("PUBSUB_30S_MAX_CONCURRENT", 200),
			},
		},
		Drain:   consumerDrain,
		OnEvent: logConsumerEvent,
	}

	log.Info().Str("region", region).Msg("pubsub consumer started")

	return consumer.Run(ctx)
}

func logConsumerEvent(ctx context.Context, e queue.Event) {
	event := map[string]any{
		"timestamp":        time.Now().Format(time.RFC3339),
		"subscription":     e.Subscription,
		"monitor_id":       e.MonitorID,
		"periodicity":      e.Periodicity,
		"job_type":         e.JobType,
		"delivery_attempt": e.DeliveryAttempt,
		"wait_ms":          int(e.Wait.Milliseconds()),
		"duration_ms":      int(e.Duration.Milliseconds()),
		"outcome":          string(e.Outcome),
	}
	if e.Err != nil {
		event["error"] = map[string]any{
			"type":    "ConsumerError",
			"message": e.Err.Error(),
		}
	}

	if shouldSample(event) {
		slog.LogAttrs(ctx, slog.LevelInfo, "message done", MapToAttrs(event)...)
	}
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

	if e.Attempts > 1 || shouldSample(event) {
		slog.LogAttrs(ctx, slog.LevelInfo, "tinybird flush", MapToAttrs(event)...)
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

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	return fallback
}
