package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Tuned for Railway internal networking: short dial timeout so a dead pod
// fails fast instead of stalling for the default 30s, plus aggressive idle
// pruning so we don't reuse connections that the platform has silently torn down.
func newTransport() *http.Transport {
	return &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          200,
		MaxIdleConnsPerHost:   50,
		IdleConnTimeout:       60 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: 60 * time.Second,
		ForceAttemptHTTP2:     true,
	}
}

var regionTargets = map[string]string{
	"europe-west4-drams3a":   "http://openstatus-checker-eu-west.railway.internal:8080",
	"us-east4-eqdc4a":        "http://openstatus-checker-us-east.railway.internal:8080",
	"us-west2":               "http://openstatus-checker-us-west.railway.internal:8080",
	"asia-southeast1-eqsg3a": "http://checker-southeast-asia.railway.internal:8080",
}

func buildProxies(transport http.RoundTripper) (map[string]*httputil.ReverseProxy, error) {
	proxies := make(map[string]*httputil.ReverseProxy, len(regionTargets))
	for region, target := range regionTargets {
		remote, err := url.Parse(target)
		if err != nil {
			return nil, fmt.Errorf("parse target for region %s: %w", region, err)
		}

		p := &httputil.ReverseProxy{
			Transport: transport,
			Rewrite: func(r *httputil.ProxyRequest) {
				r.SetURL(remote)
				r.Out.Host = remote.Host
			},
		}
		p.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, err error) {
			log.Error().
				Err(err).
				Str("region", region).
				Str("target", remote.String()).
				Str("method", req.Method).
				Str("path", req.URL.Path).
				Msg("reverse proxy transport error")
			rw.WriteHeader(http.StatusBadGateway)
		}
		p.ModifyResponse = func(resp *http.Response) error {
			if resp.StatusCode >= 500 {
				log.Error().
					Str("region", region).
					Str("target", remote.String()).
					Str("method", resp.Request.Method).
					Str("path", resp.Request.URL.Path).
					Int("status", resp.StatusCode).
					Msg("upstream returned server error")
			} else if resp.StatusCode >= 400 {
				log.Warn().
					Str("region", region).
					Str("target", remote.String()).
					Str("method", resp.Request.Method).
					Str("path", resp.Request.URL.Path).
					Int("status", resp.StatusCode).
					Msg("upstream returned client error")
			}
			return nil
		}
		proxies[region] = p
	}
	return proxies, nil
}

func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		status := c.Writer.Status()
		evt := log.Info()
		switch {
		case status >= 500:
			evt = log.Error()
		case status >= 400:
			evt = log.Warn()
		}

		evt.
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Str("region", c.Request.Header.Get("railway-region")).
			Int("status", status).
			Dur("duration", time.Since(start)).
			Msg("request")
	}
}

func proxyHandler(proxies map[string]*httputil.ReverseProxy) gin.HandlerFunc {
	return func(c *gin.Context) {
		region := c.Request.Header.Get("railway-region")
		p, ok := proxies[region]
		if !ok {
			log.Warn().
				Str("region", region).
				Str("path", c.Request.URL.Path).
				Msg("unknown or missing railway-region header")
			c.JSON(http.StatusBadGateway, gin.H{"error": "unknown region", "region": region})
			return
		}
		p.ServeHTTP(c.Writer, c.Request)
	}
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

	proxies, err := buildProxies(newTransport())
	if err != nil {
		log.Fatal().Err(err).Msg("failed to build reverse proxies")
	}

	router := gin.New()
	router.Use(gin.Recovery(), requestLogger())
	router.NoRoute(proxyHandler(proxies))

	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong", "region": region, "provider": cloudProvider})
	})

	httpServer := &http.Server{
		Addr:              fmt.Sprintf("0.0.0.0:%s", env("PORT", "8080")),
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Ctx(ctx).Error().Err(err).Msg("failed to start http server")
			cancel()
		}
	}()

	<-ctx.Done()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("failed to shutdown http server")
	}
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	return fallback
}
