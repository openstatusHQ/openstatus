package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/request"
)

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

	httpClient := &http.Client{}
	defer httpClient.CloseIdleConnections()

	router := gin.New()
	router.POST("/checker", func(c *gin.Context) {
		ctx := c.Request.Context()
		_ = ctx // TODO: use ctx.

		if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", cronSecret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		switch i, err := strconv.Atoi(c.GetHeader("X-CloudTasks-TaskRetryCount")); {
		case err != nil:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid retry count"})
			return
		case i > 1:
			// Why would that be OK?
			c.JSON(http.StatusOK, gin.H{"message": "ok"})
			return
		}

		var req request.CheckerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		response, error := checker.Ping(httpClient, req)
		if error != nil {
			// Add one more retry
			response, error = checker.Ping(httpClient, req)
			if error != nil {
				checker.SendToTinyBird(checker.PingData{
					URL:           req.URL,
					Region:        flyRegion,
					Message:       error.Error(),
					CronTimestamp: req.CronTimestamp,
					Timestamp:     req.CronTimestamp,
					MonitorID:     req.MonitorID,
					WorkspaceID:   req.WorkspaceID,
				})
				if req.Status == "active" {
					checker.UpdateStatus(checker.UpdateData{
						MonitorId: req.MonitorID,
						Status:    "error",
						Message:   error.Error(),
						Region:    flyRegion,
					})
				}

				c.JSON(http.StatusOK, gin.H{"message": "ok"})
				return
			}
		}

		if response.StatusCode < 200 || response.StatusCode >= 300 {
			// Add one more retry
			response, error = checker.Ping(httpClient, req)
			if response.StatusCode < 200 || response.StatusCode >= 300 && req.Status == "active" {
				// If the status code is not within the 200 range, we update the status to error
				checker.UpdateStatus(checker.UpdateData{
					MonitorId:  req.MonitorID,
					Status:     "error",
					StatusCode: response.StatusCode,
					Region:     flyRegion,
				})
			}
		}

		// If the status was error and the status code is within the 200 range, we update the status to active
		if req.Status == "error" && response.StatusCode >= 200 && response.StatusCode < 300 {
			// If the status was error, we update it to active
			checker.UpdateStatus(checker.UpdateData{
				MonitorId:  req.MonitorID,
				Status:     "active",
				Region:     flyRegion,
				StatusCode: response.StatusCode,
			})
		}
		// We send the data to Tinybird
		checker.SendToTinyBird(response)

		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	})

	router.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong", "fly_region": flyRegion})
		return
	})

	httpServer := &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%s", env("PORT", "8080")),
		Handler: router,
	}

	go func() {
		if err := httpServer.ListenAndServe(); err != nil {
			// Add structured logs.
			cancel()
		}
	}()

	<-ctx.Done()
	if err := httpServer.Shutdown(ctx); err != nil {
		// Add structured logs.
		return
	}
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	return fallback
}
