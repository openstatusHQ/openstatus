package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/openstatushq/openstatus/apps/checker"
	"github.com/openstatushq/openstatus/apps/checker/pkg/openstatus"
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
	//
	channels := make(map[string]chan bool)
	monitors := make(map[string]openstatus.Monitor)
	key := env("OPENSTATUS_KEY", "")

	configTicker := time.NewTicker(10 * time.Minute)
	defer configTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-configTicker.C:
			configMonitors := openstatus.GetMonitors(key)
			for _, v := range configMonitors {
				i := monitors[strconv.Itoa(v.ID)]
				// no monitors
				if i.ID == 0 {
					done := make(chan bool)
					channels[strconv.Itoa(v.ID)] = done
					monitors[strconv.Itoa(v.ID)] = v
					ScheduleJob(request.HttpCheckerRequest{}, done)
				}
			}

			for _, v := range monitors {
				found := false
				for _, m := range configMonitors {
					if v.ID == m.ID {
						found = true
						break
					}
				}
				if found {
					continue

				}
				channels[strconv.Itoa(v.ID)] <- true
				delete(monitors, strconv.Itoa(v.ID))
				delete(channels, strconv.Itoa(v.ID))

			}

		}
	}
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	return fallback
}

func ScheduleJob(req request.HttpCheckerRequest, done chan bool) {
	ticker := time.NewTicker(time.Duration(60) * time.Second)
	ctx := context.Background()

	//  We need a new client for each request to avoid connection reuse.
	requestClient := &http.Client{
		Timeout: time.Duration(req.Timeout) * time.Millisecond,
	}

	// Configure redirect policy based on FollowRedirects setting
	if !req.FollowRedirects {
		requestClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	} else {
		// Explicitly limit the number of redirects to 10 (Go's default)
		requestClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			return nil
		}
	}
	defer requestClient.CloseIdleConnections()

	for {
		select {

		case <-ticker.C:
			checker.Http(ctx, requestClient, req)

		case <-done:
			ticker.Stop()
			return
		}
	}
}
