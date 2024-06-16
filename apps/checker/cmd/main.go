package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/assertions"
	"github.com/openstatushq/openstatus/apps/checker/pkg/logger"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"

	backoff "github.com/cenkalti/backoff/v4"
)

type statusCode int

// We should export it
type PingResponse struct {
	RequestId   int64          `json:"requestId,omitempty"`
	WorkspaceId int64          `json:"workspaceId,omitempty"`
	Status      int            `json:"status,omitempty"`
	Latency     int64          `json:"latency"`
	Body        string         `json:"body,omitempty"`
	Headers     string         `json:"headers,omitempty"`
	Time        int64          `json:"time"`
	Timing      checker.Timing `json:"timing"`
	Region      string         `json:"region"`
}

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
		dataSourceName := "ping_response__v8"
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

		// Might be a more efficient way to do it
		var i interface{} = req.RawAssertions
		jsonBytes, _ := json.Marshal(i)
		assertionAsString := string(jsonBytes)
		if assertionAsString == "null" {
			assertionAsString = ""
		}

		var called int
		op := func() error {
			called++
			res, err := checker.Ping(ctx, requestClient, req)
			if err != nil {
				return fmt.Errorf("unable to ping: %w", err)
			}
			statusCode := statusCode(res.StatusCode)

			var isSuccessfull bool = true
			if len(req.RawAssertions) > 0 {
				for _, a := range req.RawAssertions {
					var assert request.Assertion
					err = json.Unmarshal(a, &assert)
					if err != nil {
						// handle error
						return fmt.Errorf("unable to unmarshal assertion: %w", err)
					}
					switch assert.AssertionType {
					case request.AssertionHeader:
						var target assertions.HeaderTarget
						if err := json.Unmarshal(a, &target); err != nil {
							return fmt.Errorf("unable to unmarshal IntTarget: %w", err)
						}
						isSuccessfull = isSuccessfull && target.HeaderEvaluate(res.Headers)

					case request.AssertionTextBody:
						var target assertions.StringTargetType
						if err := json.Unmarshal(a, &target); err != nil {
							return fmt.Errorf("unable to unmarshal IntTarget: %w", err)
						}
						isSuccessfull = isSuccessfull && target.StringEvaluate(res.Body)

					case request.AssertionStatus:
						var target assertions.StatusTarget
						if err := json.Unmarshal(a, &target); err != nil {
							return fmt.Errorf("unable to unmarshal IntTarget: %w", err)
						}
						isSuccessfull = isSuccessfull && target.StatusEvaluate(int64(res.StatusCode))
					case request.AssertionJsonBody:
						fmt.Println("assertion type", assert.AssertionType)
					default:
						fmt.Println("⚠️ Not Handled assertion type", assert.AssertionType)
					}
				}
			} else {
				isSuccessfull = statusCode.IsSuccessful()
			}

			// let's retry at least once if the status code is not successful.
			if !isSuccessfull && called < 2 {
				return fmt.Errorf("unable to ping: %v with status %v", res, res.StatusCode)
			}

			// it's in error if not successful
			if isSuccessfull {
				res.Error = 0
				// Small trick to avoid sending the body at the moment to TB
				res.Body = ""
			} else {
				res.Error = 1
			}

			res.Assertions = assertionAsString
			if !isSuccessfull && req.Status == "active" {
				// Q: Why here we do not check if the status was previously active?
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:     req.MonitorID,
					Status:        "error",
					StatusCode:    res.StatusCode,
					Region:        flyRegion,
					Message:       res.Message,
					CronTimestamp: req.CronTimestamp,
				})
			}

			if req.Status == "error" && isSuccessfull {
				// Q: Why here we check the data before updating the status in this scenario?
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:     req.MonitorID,
					Status:        "active",
					Region:        flyRegion,
					StatusCode:    res.StatusCode,
					CronTimestamp: req.CronTimestamp,
				})
			}

			if err := tinybirdClient.SendEvent(ctx, res, dataSourceName); err != nil {
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
				Error:         1,
				Assertions:    assertionAsString,
				Body:          "",
			}, dataSourceName); err != nil {
				log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
			}

			if req.Status == "active" {
				checker.UpdateStatus(ctx, checker.UpdateData{
					MonitorId:     req.MonitorID,
					Status:        "error",
					Message:       err.Error(),
					Region:        flyRegion,
					CronTimestamp: req.CronTimestamp,
				})
			}

		}

		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong", "fly_region": flyRegion})
	})

	router.POST("/ping/:region", func(c *gin.Context) {
		dataSourceName := "check_response__v1"
		region := c.Param("region")
		if region == "" {
			c.String(http.StatusBadRequest, "region is required")
			return
		}
		fmt.Printf("Start of /ping/%s\n", region)

		if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", cronSecret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
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
		var res checker.Response
		op := func() error {
			r, err := checker.SinglePing(c.Request.Context(), requestClient, req)
			if err != nil {
				return fmt.Errorf("unable to ping: %w", err)
			}

			r.Region = flyRegion

			headersAsString, err := json.Marshal(r.Headers)
			if err != nil {
				return nil
			}

			tbData := PingResponse{
				RequestId:   req.RequestId,
				WorkspaceId: req.WorkspaceId,
				Status:      r.Status,
				Latency:     r.Latency,
				Body:        r.Body,
				Headers:     string(headersAsString),
				Time:        r.Time,
				Timing:      r.Timing,
				Region:      r.Region,
			}

			res = r
			if tbData.RequestId != 0 {
				if err := tinybirdClient.SendEvent(ctx, tbData, dataSourceName); err != nil {
					log.Ctx(ctx).Error().Err(err).Msg("failed to send event to tinybird")
				}
			}
			return nil
		}
		if err := backoff.Retry(op, backoff.WithMaxRetries(backoff.NewExponentialBackOff(), 3)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		c.JSON(http.StatusOK, res)
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
