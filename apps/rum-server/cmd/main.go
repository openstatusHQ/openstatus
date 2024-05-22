package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/mileusna/useragent"

	"github.com/gin-gonic/gin"
	"github.com/openstatusHQ/rum-server/pkg/clickhouse"
	"github.com/openstatusHQ/rum-server/pkg/turso"
	"github.com/openstatusHQ/rum-server/pkg/utils"
	"github.com/openstatusHQ/rum-server/request"

	"github.com/rs/zerolog/log"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	flyRegion := utils.Env("FLY_REGION", "local")

	go func() {
		<-done
		cancel()
	}()

	// Clickhouse
	chClient, err := clickhouse.NewClient()
	if err != nil {
		fmt.Println(err)
		log.Ctx(ctx).Error().Err(err).Msg("failed to create clickhouse client")
		return
	}

	sqlClient, err := turso.GetClient()
	if err != nil {
		fmt.Println(err)
		log.Ctx(ctx).Error().Err(err).Msg("failed to create turso client")
		return
	}
	defer sqlClient.Close()

	router := gin.New()
	v1 := router.Group("/v1")

	router.GET("/health", func(c *gin.Context) {
		// err := chClient.Ping(c.Request.Context())
		// if err != nil {
		// 	c.JSON(http.StatusInternalServerError, gin.H{"message": "error"})
		// 	return
		// }
		c.JSON(http.StatusOK, gin.H{"message": "pong", "fly_region": flyRegion})
	})
	v1.POST("/vitals", func(c *gin.Context) {
		var req request.WebVitalsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		// Check if dsn exists
		_, err := turso.GetCurrentWorkspace(sqlClient, req.DSN)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		ua := useragent.Parse(c.Request.UserAgent())

		// we should read from user agent and get the  user ip information when we are not using the cloudflare proxy

		// We should extract this with maxminddb
		// req.City, req.Continent, req.Country, ua.Language, req.RegionCode, req.Timezone,
		value := fmt.Sprintf(`INSERT INTO cwv VALUES (
			now('Etc/UTC'), '%s','%s','%s','%s','%s','%s','%s','%s','%s', '%s',%f
		)`, ua.Name, req.DSN, ua.Device, req.EventName, req.Href, req.ID, ua.OS, req.Path, ua.Device, req.Speed, req.Value)
		fmt.Println(value)
		err = chClient.AsyncInsert(ctx, value, true)
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// We use this when we proxy the request via cloudflare
	v1.POST("/proxy/cloudflare", func(c *gin.Context) {
		var req request.CloudflareRequestProxy
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		// Check if dsn exists
		_, err := turso.GetCurrentWorkspace(sqlClient, req.DSN)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		value := fmt.Sprintf(`INSERT INTO cwv VALUES (
			now('Etc/UTC'), '%s','%s', '%s', '%s','%s','%s','%s','%s','%s', '%s','%s','%s','%s', '%s','%s','%s','%s', %f
		)`, req.Browser, req.City, req.Continent, req.Country, req.DSN, req.Device, req.EventName, req.Href, req.ID, req.Language, req.OS, req.Path, req.Rating, req.RegionCode, req.Screen, req.Speed, req.Timezone, req.Value)
		fmt.Println(value)
		err = chClient.AsyncInsert(ctx, value, true)
		if err != nil {
			log.Ctx(ctx).Error().Err(err).Msg("failed to decode checker request")
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	httpServer := &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%s", utils.Env("PORT", "8080")),
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
