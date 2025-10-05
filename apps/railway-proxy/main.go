package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

func proxy(c *gin.Context) {

	var targetUrl string

	region := c.Request.Header.Get("railway-region")

	switch region {
	case "europe-west4-drams3a":
		targetUrl = "http://openstatus-checker-eu-west.railway.internal:8080"
	case "us-east4-eqdc4a":
		targetUrl = "http://openstatus-checker-us-east.railway.internal:8080"
	case "us-west2":
		targetUrl = "http://openstatus-checker-us-west.railway.internal:8080"
	case "asia-southeast1-eqsg3a":
		targetUrl = "http://checker-southeast-asia.railway.internal:8080"
	default:
		fmt.Println("No region")
	}
	remote, err := url.Parse(targetUrl)
	if err != nil {
		panic(err)
	}

	proxy := httputil.NewSingleHostReverseProxy(remote)

	c.Request.Host = remote.Host

	proxy.ServeHTTP(c.Writer, c.Request)
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

	cloudProvider := env("CLOUD_PROVIDER", "railway")
	region := env("RAILWAY_REPLICA_REGION", env("REGION", "local"))
	router := gin.New()

	//Create a catchall route
	router.NoRoute(proxy)

	router.GET("/healthz", func(c *gin.Context) {
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
