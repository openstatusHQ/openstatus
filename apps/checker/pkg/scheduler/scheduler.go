package scheduler

import (
	"context"
	"log"
	"sync"
	"time"

	"connectrpc.com/connect"
	"github.com/madflojo/tasks"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

const (
	Interval10s = "10s"
	Interval30s = "30s"
	Interval1m  = "1m"
	Interval5m  = "5m"
	Interval10m = "10m"
	Interval30m = "30m"
	Interval1h  = "1h"
)

type MonitorManager struct {
	Client    v1.PrivateLocationServiceClient
	JobRunner job.JobRunner
	Scheduler *tasks.Scheduler
	mu        sync.Mutex
}

// UpdateMonitors fetches the latest monitors and starts/stops jobs as needed
func (mm *MonitorManager) UpdateMonitors(ctx context.Context) {
	res, err := mm.Client.Monitors(ctx, &connect.Request[v1.MonitorsRequest]{})
	if err != nil {
		log.Printf("Failed to fetch monitors: %v", err)
		return
	}

	currentIDs := make(map[string]struct{})

	// HTTP monitors: start jobs for new monitors
	for _, m := range res.Msg.HttpMonitors {
		currentIDs[m.Id] = struct{}{}
		_, err := mm.Scheduler.Lookup(m.Id)
		if err != nil {
			interval := time.Duration(intervalToSecond(m.Periodicity)) * time.Second
			task := tasks.Task{
				Interval:          interval,
				RunOnce:           false,
				RunSingleInstance: true,
				// StartAfter: time.Duration(1) * time.Second,
				ErrFunc: func(e error) {
					log.Printf("An error occurred when executing task  %s", e)
				},
				FuncWithTaskContext: func(ctx tasks.TaskContext) error {
					monitor := m
					c := context.Background()
					log.Printf("Starting job for monitor %s (%s)", monitor.Id, monitor.Url)
					data, err := mm.JobRunner.HTTPJob(c, monitor)

					if err != nil {
						log.Printf("Monitor check failed for %s (%s): %v", monitor.Id, monitor.Url, err)
						return err
					}
					resp, ingestErr := mm.Client.IngestHTTP(c, &connect.Request[v1.IngestHTTPRequest]{
						Msg: &v1.IngestHTTPRequest{
							MonitorId:     monitor.Id,
							Id:            data.ID,
							Url:           monitor.Url,
							Message:       data.Message,
							Latency:       data.Latency,
							Timing:        data.Timing,
							Headers:       data.Headers,
							Body:          data.Body,
							RequestStatus: data.RequestStatus,
							StatusCode:    int64(data.StatusCode),
							Error:         int64(data.Error),
							CronTimestamp: data.CronTimestamp,
							Timestamp:     data.Timestamp,
						},
					})
					if ingestErr != nil {
						log.Printf("Failed to ingest HTTP result for %s (%s): %v", monitor.Id, monitor.Url, ingestErr)
						return ingestErr
					}
					log.Printf("Monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Url, resp)
					return nil
				},
			}

			err := mm.Scheduler.AddWithID(m.Id, &task)

			if err != nil {
				log.Printf("Failed to add HTTP monitor job for %s (%s): %v", m.Id, m.Url, err)
				continue
			}
			log.Printf("Started monitoring job for %s (%s)", m.Id, m.Url)
			continue
		}

	}

	// TCP monitors: start jobs for new monitors
	for _, m := range res.Msg.TcpMonitors {
		currentIDs[m.Id] = struct{}{}
		_, err := mm.Scheduler.Lookup(m.Id)
		if err != nil {

			interval := time.Duration(intervalToSecond(m.Periodicity)) * time.Second
			task := tasks.Task{
				Interval: interval,
				RunOnce:  false,
				// StartAfter: time.Now().Add(5 * time.Millisecond),
				RunSingleInstance: true,
				FuncWithTaskContext: func(ctx tasks.TaskContext) error {

					monitor := m
					log.Printf("Starting TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
					data, err := mm.JobRunner.TCPJob(ctx.Context, monitor)
					if err != nil {
						log.Printf("TCP monitor check failed for %s (%s): %v", monitor.Id, monitor.Uri, err)
					}
					resp, ingestErr := mm.Client.IngestTCP(ctx.Context, &connect.Request[v1.IngestTCPRequest]{
						Msg: &v1.IngestTCPRequest{
							MonitorId:     monitor.Id,
							Id:            data.ID,
							Uri:           monitor.Uri,
							Message:       data.Message,
							Latency:       data.Latency,
							RequestStatus: data.RequestStatus,
							Error:         int64(data.Error),
							CronTimestamp: data.CronTimestamp,
							Timestamp:     data.Timestamp,
						},
					})
					if ingestErr != nil {
						log.Printf("Failed to ingest TCP result for %s (%s): %v", monitor.Id, monitor.Uri, ingestErr)
						return ingestErr
					}
					log.Printf("TCP monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Uri, resp)

					return nil
				},
			}
			err := mm.Scheduler.AddWithID(m.Id, &task)

			if err != nil {
				log.Printf("Failed to add TCP monitor job for %s (%s): %v", m.Id, m.Uri, err)
				continue
			}
			log.Printf("Started TCP monitoring job for %s (%s)", m.Id, m.Uri)
		}
	}

	for _, m := range res.Msg.DnsMonitors {
		currentIDs[m.Id] = struct{}{}
		_, err := mm.Scheduler.Lookup(m.Id)
		if err != nil {

			interval := time.Duration(intervalToSecond(m.Periodicity)) * time.Second
			task := tasks.Task{
				Interval: interval,
				RunOnce:  false,
				// StartAfter: time.Now().Add(5 * time.Millisecond),
				RunSingleInstance: true,
				FuncWithTaskContext: func(ctx tasks.TaskContext) error {

					monitor := m
					log.Printf("Starting TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
					_, err := mm.JobRunner.DNSJob(ctx.Context, monitor)
					if err != nil {
						log.Printf("TCP monitor check failed for %s (%s): %v", monitor.Id, monitor.Uri, err)
					}
					resp, ingestErr := mm.Client.IngestDNS(ctx.Context, &connect.Request[v1.IngestDNSRequest]{
						Msg: &v1.IngestDNSRequest{
							MonitorId: monitor.Id,

							// Id:            data.ID,
							// Uri:           monitor.Uri,
							// Message:       data.Message,
							// Latency:       data.Latency,
							// RequestStatus: data.RequestStatus,
							// Error:         int64(data.Error),
							// CronTimestamp: data.CronTimestamp,
							// Timestamp:     data.Timestamp,
						},
					})
					if ingestErr != nil {
						log.Printf("Failed to ingest TCP result for %s (%s): %v", monitor.Id, monitor.Uri, ingestErr)
						return ingestErr
					}
					log.Printf("TCP monitor check succeeded for %s (%s), ingest response: %v", monitor.Id, monitor.Uri, resp)

					return nil
				},
			}
			err := mm.Scheduler.AddWithID(m.Id, &task)

			if err != nil {
				log.Printf("Failed to add TCP monitor job for %s (%s): %v", m.Id, m.Uri, err)
				continue
			}
			log.Printf("Started TCP monitoring job for %s (%s)", m.Id, m.Uri)
		}
	}

	for id := range mm.Scheduler.Tasks() {
		if _, stillExists := currentIDs[id]; !stillExists {
			mm.Scheduler.Del(id)
		}
	}

}

func intervalToSecond(interval string) int {
	switch interval {
	case Interval30s:
		return 30
	case Interval1m:
		return 60
	case Interval5m:
		return 300
	case Interval10m:
		return 600
	case Interval30m:
		return 1800
	case Interval1h:
		return 3600
	case Interval10s:
		return 10
	default:
		return 0
	}
}
