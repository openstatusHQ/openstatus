package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/logger"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"

	unkey "github.com/WilfredAlmeida/unkey-go/features"
	backoff "github.com/cenkalti/backoff/v4"
)

type statusCode int

func (s statusCode) IsSuccessful() bool {
	return s >= 200 && s < 300
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-done
		cancel()
	}()

	// environment variables.
	flyRegion := env("FLY_REGION", "local")
	cronSecret := env("CRON_SECRET", "")
	tinyBirdToken := env("TINYBIRD_TOKEN", "")
	logLevel := env("LOG_LEVEL", "warn")

	logger.Configure(logLevel)

	// packages.
	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}

	defer httpClient.CloseIdleConnections()

	tinybirdClient := tinybird.NewClient(httpClient, tinyBirdToken)

	router := gin.New()
	router.POST("/checker", func(c *gin.Context) {
		ctx := c.Request.Context()

		if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", cronSecret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// if the request has been routed to a wrong region, we forward it to the correct one.
		region := c.GetHeader("fly-prefer-region")
		if region != "" && region != flyRegion {
			c.Header("fly-replay", fmt.Sprintf("region=%s", region))
			c.String(http.StatusAccepted, "Forwarding request to %s", region)
			return
		}

		var req request.CheckerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		//  We need a new client for each request to avoid connection reuse.
		requestClient := &http.Client{
			Timeout: 45 * time.Second,
		}
		defer requestClient.CloseIdleConnections()

		var called int
		op := func() error {
			called++
			res, err := checker.Ping(ctx, requestClient, req)
			if err != nil {
				return fmt.Errorf("unable to ping: %w", err)
			}
			statusCode := statusCode(res.StatusCode)
			// let's retry at least once if the status code is not successful.
			if !statusCode.IsSuccessful() && called < 2 {
				return fmt.Errorf("unable to ping: %v with status %v", res, res.StatusCode)
			}

			if !statusCode.IsSuccessful() && req.Status == "active" {
				// Q: Why here we do not check if the status was previously active?
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:  req.MonitorID,
					Status:     "error",
					StatusCode: res.StatusCode,
					Region:     flyRegion,
					Message:    res.Message,
					CronTimestamp: req.CronTimestamp,
				})
			}

			if req.Status == "error" && statusCode.IsSuccessful() {
				// Q: Why here we check the data before updating the status in this scenario?
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:  req.MonitorID,
					Status:     "active",
					Region:     flyRegion,
					StatusCode: res.StatusCode,
					CronTimestamp: req.CronTimestamp,

				})
			}
			if err := tinybirdClient.SendEvent(ctx, res); err != nil {
				log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
			}

			return nil
		}

		if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
			if err := tinybirdClient.SendEvent(ctx, checker.PingData{
				URL:           req.URL,
				Region:        flyRegion,
				Message:       err.Error(),
				CronTimestamp: req.CronTimestamp,
				Timestamp:     req.CronTimestamp,
				MonitorID:     req.MonitorID,
				WorkspaceID:   req.WorkspaceID,
			}); err != nil {
				log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
			}

			if req.Status == "active" {
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId: req.MonitorID,
					Status:    "error",
					Message:   err.Error(),
					Region:    flyRegion,
					CronTimestamp: req.CronTimestamp,
				})
			}

		}

		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong", "fly_region": flyRegion})
		return
	})

	router.POST("/ping/:region", func(c *gin.Context) {
		region := c.Param("region")
		if region == "" {
			c.String(http.StatusBadRequest, "region is required")
			return
		}
		fmt.Printf("Start of /ping/%s\n", region)

		apiKey := c.GetHeader("x-openstatus-key")
		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		response, err := unkey.KeyVerify(apiKey)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		if !response.Valid {
			fmt.Println("Key is valid")
		}

		if region != flyRegion {
			c.Header("fly-replay", fmt.Sprintf("region=%s", region))
			c.String(http.StatusAccepted, "Forwarding request to %s", region)
			return
		}
		//  We need a new client for each request to avoid connection reuse.
		requestClient := &http.Client{
			Timeout: 45 * time.Second,
		}
		defer requestClient.CloseIdleConnections()

		var req request.PingRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		res, err := checker.SinglePing(c.Request.Context(), requestClient, req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		c.JSON(http.StatusOK, res)
		return
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

	<-ctx.Done()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to shutdown http server")
		return
	}
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	return fallback
}
