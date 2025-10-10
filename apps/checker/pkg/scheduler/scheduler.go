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
	TcpMonitors    map[string]*v1.TCPMonitor
	HttpMonitors    map[string]*v1.HTTPMonitor
	MonitorChannels map[string]chan bool
}

func (mm *MonitorManager) UpdateMonitors(ctx context.Context, apiKey string) {
	client := v1.NewPrivateLocationServiceClient(
		http.DefaultClient,
		"http://localhost:8080",
		connect.WithHTTPGet(),
	)

	ctx, callInfo := connect.NewClientContext(ctx)
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
			go ScheduleHTTPJob(ctx, m, doneChan)
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
	// TCP monitors: start jobs for new monitors
	for _, m := range res.Msg.TcpMonitors {
		currentIDs[m.Id] = struct{}{}
		if _, exists := mm.TcpMonitors[m.Id]; !exists {
			doneChan := make(chan bool)
			mm.MonitorChannels[m.Id] = doneChan
			mm.TcpMonitors[m.Id] = m
			go ScheduleTCPJob(ctx, m, doneChan)
			log.Printf("Started TCP monitoring job for %s (%s:%d)", m.Id, m.Host, m.Port)
		}
	}

	// Stop jobs for TCP monitors that no longer exist
	for id, monitor := range mm.TcpMonitors {
		if _, stillExists := currentIDs[id]; !stillExists {
			if ch, ok := mm.MonitorChannels[id]; ok {
				ch <- true
				close(ch)
			}
			log.Printf("Stopped TCP monitoring job for %s (%s:%d)", id, monitor.Host, monitor.Port)
			delete(mm.TcpMonitors, id)
			delete(mm.MonitorChannels, id)
		}
	}
}

func intervalToSecond(interval string) int {
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
func ScheduleHTTPJob(ctx context.Context, monitor *v1.HTTPMonitor, done chan bool) {

	interval := intervalToSecond(monitor.Periodicity)

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			fmt.Printf("Starting job for monitor %s (%s)\n", monitor.Id, monitor.Url)
			data, err := job.HTTPJob(ctx, monitor)
			if err != nil {
				log.Printf("Monitor check failed for %s (%s): %v", monitor.Id, monitor.Url, err)
			} else {
				fmt.Print(data)
				log.Printf("Monitor check succeeded for %s (%s)", monitor.Id, monitor.Url)
			}
		case <-done:
			log.Printf("Shutting down job for monitor %s (%s)", monitor.Id, monitor.Url)
			return
		}
	}
}



func ScheduleTCPJob(ctx context.Context, monitor *v1.TCPMonitor, done chan bool) {

	interval := intervalToSecond(monitor.Periodicity)

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			fmt.Printf("Starting TCP job for monitor %s (%s:%d)\n", monitor.Id, monitor.Host, monitor.Port)
			data, err := job.TCPJob(ctx, monitor)
			if err != nil {
				log.Printf("TCP monitor check failed for %s (%s:%d): %v", monitor.Id, monitor.Host, monitor.Port, err)
			} else {
				fmt.Print(data)
				log.Printf("TCP monitor check succeeded for %s (%s:%d)", monitor.Id, monitor.Host, monitor.Port)
			}
		case <-done:
			log.Printf("Shutting down TCP job for monitor %s (%s:%d)", monitor.Id, monitor.Host, monitor.Port)
			return
		}
	}
}
