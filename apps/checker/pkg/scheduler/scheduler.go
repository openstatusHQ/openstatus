package scheduler

import (
	"bytes"
	"context"
	"log"
	"sync"
	"time"

	"connectrpc.com/connect"
	"github.com/madflojo/tasks"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
	"google.golang.org/protobuf/proto"
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
	configs   map[string][]byte
}

// shouldSchedule reports whether a task has to be created for the monitor, and
// drops the running one first when the config changed: a task captures its
// monitor when it is created, so an edited monitor would otherwise keep
// checking with the config it had on the probe's first fetch.
func (mm *MonitorManager) shouldSchedule(id string, monitor proto.Message) bool {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	if mm.configs == nil {
		mm.configs = make(map[string][]byte)
	}

	config, err := proto.MarshalOptions{Deterministic: true}.Marshal(monitor)
	if err != nil {
		log.Printf("Failed to encode config for monitor %s: %v", id, err)
		config = nil
	}

	if _, lookupErr := mm.Scheduler.Lookup(id); lookupErr != nil {
		mm.configs[id] = config
		return true
	}

	if bytes.Equal(mm.configs[id], config) {
		return false
	}

	log.Printf("Config changed for monitor %s, rescheduling", id)
	mm.Scheduler.Del(id)
	mm.configs[id] = config
	return true
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
		if !mm.shouldSchedule(m.Id, m) {
			continue
		}

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
				data, err := mm.JobRunner.HTTPJob(c, monitor, res.Msg.Region)

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
				log.Printf("Monitor check for %s (%s) ingested with status %q (code %d), ingest response: %v", monitor.Id, monitor.Url, data.RequestStatus, data.StatusCode, resp)
				return nil
			},
		}

		if err := mm.Scheduler.AddWithID(m.Id, &task); err != nil {
			log.Printf("Failed to add HTTP monitor job for %s (%s): %v", m.Id, m.Url, err)
			continue
		}
		log.Printf("Started monitoring job for %s (%s)", m.Id, m.Url)
	}

	// TCP monitors: start jobs for new monitors
	for _, m := range res.Msg.TcpMonitors {
		currentIDs[m.Id] = struct{}{}
		if !mm.shouldSchedule(m.Id, m) {
			continue
		}

		interval := time.Duration(intervalToSecond(m.Periodicity)) * time.Second
		task := tasks.Task{
			Interval: interval,
			RunOnce:  false,
			// StartAfter: time.Now().Add(5 * time.Millisecond),
			RunSingleInstance: true,
			FuncWithTaskContext: func(ctx tasks.TaskContext) error {

				monitor := m
				c := context.Background()
				log.Printf("Starting TCP job for monitor %s (%s)", monitor.Id, monitor.Uri)
				data, err := mm.JobRunner.TCPJob(c, monitor, res.Msg.Region)
				if err != nil {
					log.Printf("TCP monitor check failed for %s (%s): %v", monitor.Id, monitor.Uri, err)
					return err
				}
				resp, ingestErr := mm.Client.IngestTCP(c, &connect.Request[v1.IngestTCPRequest]{
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
				log.Printf("TCP monitor check for %s (%s) ingested with status %q, ingest response: %v", monitor.Id, monitor.Uri, data.RequestStatus, resp)

				return nil
			},
		}

		if err := mm.Scheduler.AddWithID(m.Id, &task); err != nil {
			log.Printf("Failed to add TCP monitor job for %s (%s): %v", m.Id, m.Uri, err)
			continue
		}
		log.Printf("Started TCP monitoring job for %s (%s)", m.Id, m.Uri)
	}

	for _, m := range res.Msg.DnsMonitors {
		currentIDs[m.Id] = struct{}{}
		if !mm.shouldSchedule(m.Id, m) {
			continue
		}

		interval := time.Duration(intervalToSecond(m.Periodicity)) * time.Second
		task := tasks.Task{
			Interval: interval,
			RunOnce:  false,
			// StartAfter: time.Now().Add(5 * time.Millisecond),
			RunSingleInstance: true,
			FuncWithTaskContext: func(ctx tasks.TaskContext) error {

				monitor := m
				c := context.Background()
				log.Printf("Starting DNS job for monitor %s (%s)", monitor.Id, monitor.Uri)
				_, err := mm.JobRunner.DNSJob(c, monitor)
				if err != nil {
					log.Printf("DNS monitor check failed for %s (%s): %v", monitor.Id, monitor.Uri, err)
					return err
				}
				resp, ingestErr := mm.Client.IngestDNS(c, &connect.Request[v1.IngestDNSRequest]{
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
					log.Printf("Failed to ingest DNS result for %s (%s): %v", monitor.Id, monitor.Uri, ingestErr)
					return ingestErr
				}
				log.Printf("DNS monitor check for %s (%s) ingested, ingest response: %v", monitor.Id, monitor.Uri, resp)

				return nil
			},
		}

		if err := mm.Scheduler.AddWithID(m.Id, &task); err != nil {
			log.Printf("Failed to add DNS monitor job for %s (%s): %v", m.Id, m.Uri, err)
			continue
		}
		log.Printf("Started DNS monitoring job for %s (%s)", m.Id, m.Uri)
	}

	mm.mu.Lock()
	for id := range mm.Scheduler.Tasks() {
		if _, stillExists := currentIDs[id]; !stillExists {
			mm.Scheduler.Del(id)
			delete(mm.configs, id)
		}
	}
	mm.mu.Unlock()

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
