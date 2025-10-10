package scheduler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

type MonitorManager struct {
	HttpMonitors    map[string]*v1.HTTPMonitor
	MonitorChannels map[string]chan bool
}


func (mm *MonitorManager) UpdateMonitors(apiKey string) {
	client := v1.NewPrivateLocationServiceClient(
		http.DefaultClient,
		"http://localhost:8080",
		connect.WithHTTPGet(),
	)

	ctx, callInfo := connect.NewClientContext(context.Background())
	callInfo.RequestHeader().Set("openstatus-token", apiKey)
	res, err := client.Monitors(ctx, &connect.Request[v1.MonitorsRequest]{})
	if err != nil {
		log.Fatal(err)
	}

	currentIDs := make(map[string]struct{})

	for _, m := range res.Msg.HttpMonitors {
		currentIDs[m.Id] = struct{}{}
		if _, exists := mm.HttpMonitors[m.Id]; !exists {
			doneChan := make(chan bool)
			mm.MonitorChannels[m.Id] = doneChan
			mm.HttpMonitors[m.Id] = m
			go ScheduleJob(*m, doneChan)
			log.Printf("Started monitoring job for %s (%s)", m.Id, m.Url)
		}
	}

	// Stop jobs for monitors that no longer exist
	for id, monitor := range mm.HttpMonitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			if ch, ok := mm.MonitorChannels[id]; ok {
				ch <- true
				close(ch)
			}
			log.Printf("Stopped monitoring job for %s (%s)", id, monitor.Url)
			delete(mm.HttpMonitors, id)
			delete(mm.MonitorChannels, id)
		}
	}
}

func intervalToSecond(interval string)int {
	switch interval {
		case "30s":
			return 30
		case "1m":
			return 60
		case "5m":
			return 300
		case "10m":
			return 600
		case "30m":
			return 1800
		case "1h":
			return 3600

		default:
			return 0
	}
}
func ScheduleJob(monitor v1.HTTPMonitor, done chan bool) {

	interval := intervalToSecond(monitor.Periodicity)

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()


	for {
		select {
		case <-ticker.C:
			fmt.Printf("Starting job for monitor %s (%s)\n", monitor.Id, monitor.Url)
			data, err := job.HTTPJob(monitor)
			if err != nil {
				log.Printf("Monitor check failed for %s (%s): %v",monitor.Id, monitor.Url, err)
			} else {
				fmt.Print(data)
				log.Printf("Monitor check succeeded for %s (%s)", monitor.Id, monitor.Url)
			}
		case <-done:
			log.Printf("Shutting down job for monitor %s (%s)",monitor.Id, monitor.Url)
			return
		}
	}
}
