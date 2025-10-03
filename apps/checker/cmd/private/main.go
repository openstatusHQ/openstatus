package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/pkg/openstatus"
)


func main(){
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-done
		cancel()
	}()
	//

	key := env("OPENSTATUS_KEY", "")

	configTicker := time.NewTicker(10 * time.Minute)
	defer configTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-configTicker.C:
		openstatus.GetMonitors(key)
			// Fetch and update configuration
		}
	}
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	return fallback
}
