// Command pubsub-gate is the go/no-go check before routing cron checks through
// Pub/Sub: every checker subscription must have a live consumer, and one
// synthetic check published to each topic must land in Tinybird.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	monitoring "cloud.google.com/go/monitoring/apiv3/v2"
	"cloud.google.com/go/monitoring/apiv3/v2/monitoringpb"
	"cloud.google.com/go/pubsub/v2"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/openstatushq/openstatus/apps/checker/pkg/gcp"
	"github.com/openstatushq/openstatus/apps/checker/pkg/queue"
)

type target struct {
	region        string
	subscription  string
	cronTimestamp int64
	pulls         int64
	latency       time.Duration
	landed        bool
}

func main() {
	project := flag.String("project", "openstatus-402607", "GCP project id")
	regionsFile := flag.String("regions", "../workflows/src/cron/checker-regions.json", "checker regions JSON")
	monitorID := flag.String("monitor-id", "", "id of the inactive pubsub-gate monitor")
	workspaceID := flag.String("workspace-id", "", "workspace of the pubsub-gate monitor")
	probeURL := flag.String("url", "https://www.openstatus.dev/api/ping", "URL the synthetic check probes")
	timeout := flag.Duration("timeout", 3*time.Minute, "how long to wait for every Tinybird row")
	flag.Parse()

	if *monitorID == "" || *workspaceID == "" {
		fmt.Fprintln(os.Stderr, "-monitor-id and -workspace-id are required")
		os.Exit(2)
	}
	tinybirdToken := os.Getenv("TINYBIRD_TOKEN")
	if tinybirdToken == "" {
		fmt.Fprintln(os.Stderr, "TINYBIRD_TOKEN (with read access to ping_response__v8) is required")
		os.Exit(2)
	}

	regions, err := readRegions(*regionsFile)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	ctx := context.Background()
	credentials, err := gcp.Credentials()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	creds := option.WithAuthCredentials(credentials)

	base := time.Now().UnixMilli()
	targets := make([]*target, 0, len(regions)*2)
	for _, region := range regions {
		for i, thirty := range []bool{false, true} {
			targets = append(targets, &target{
				region:        region,
				subscription:  queue.Subscription(region, thirty),
				cronTimestamp: base + int64(i),
			})
		}
	}

	if err := countStreamingPulls(ctx, *project, creds, targets); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	if err := publishSynthetic(ctx, *project, creds, targets, *monitorID, *workspaceID, *probeURL); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	waitForRows(ctx, tinybirdToken, *monitorID, base, targets, *timeout)

	if !report(targets) {
		os.Exit(1)
	}
}

func readRegions(path string) ([]string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading regions: %w", err)
	}
	var regions []string
	if err := json.Unmarshal(raw, &regions); err != nil {
		return nil, fmt.Errorf("decoding regions: %w", err)
	}
	if len(regions) == 0 {
		return nil, fmt.Errorf("no regions in %s", path)
	}

	return regions, nil
}

func countStreamingPulls(ctx context.Context, project string, creds option.ClientOption, targets []*target) error {
	client, err := monitoring.NewMetricClient(ctx, creds)
	if err != nil {
		return fmt.Errorf("creating monitoring client: %w", err)
	}
	defer client.Close()

	now := time.Now()
	it := client.ListTimeSeries(ctx, &monitoringpb.ListTimeSeriesRequest{
		Name:   "projects/" + project,
		Filter: `metric.type = "pubsub.googleapis.com/subscription/open_streaming_pulls" AND resource.labels.subscription_id = starts_with("checker-")`,
		Interval: &monitoringpb.TimeInterval{
			StartTime: timestamppb.New(now.Add(-5 * time.Minute)),
			EndTime:   timestamppb.New(now),
		},
		View: monitoringpb.ListTimeSeriesRequest_FULL,
	})

	pulls := map[string]int64{}
	for {
		ts, err := it.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return fmt.Errorf("listing open_streaming_pulls: %w", err)
		}
		if ts.Metric.Labels["status"] != "ok" || len(ts.Points) == 0 {
			continue
		}
		pulls[ts.Resource.Labels["subscription_id"]] += ts.Points[0].Value.GetInt64Value()
	}

	for _, t := range targets {
		t.pulls = pulls[t.subscription]
	}

	return nil
}

func publishSynthetic(ctx context.Context, project string, creds option.ClientOption, targets []*target, monitorID, workspaceID, probeURL string) error {
	client, err := pubsub.NewClient(ctx, project, creds)
	if err != nil {
		return fmt.Errorf("creating pubsub client: %w", err)
	}
	defer client.Close()

	results := make([]*pubsub.PublishResult, len(targets))
	for i, t := range targets {
		data, err := json.Marshal(map[string]any{
			"workspaceId":     workspaceID,
			"monitorId":       monitorID,
			"url":             probeURL,
			"method":          "GET",
			"cronTimestamp":   t.cronTimestamp,
			"body":            "",
			"headers":         []string{},
			"status":          "active",
			"assertions":      nil,
			"degradedAfter":   nil,
			"timeout":         45000,
			"trigger":         "cron",
			"retry":           1,
			"followRedirects": true,
		})
		if err != nil {
			return fmt.Errorf("encoding payload: %w", err)
		}
		publisher := client.Publisher(t.subscription)
		defer publisher.Stop()
		results[i] = publisher.Publish(ctx, &pubsub.Message{
			Data: data,
			Attributes: map[string]string{
				"jobType":     "http",
				"periodicity": "gate",
				"monitorId":   monitorID,
				"region":      t.region,
			},
		})
	}

	for i, r := range results {
		if _, err := r.Get(ctx); err != nil {
			return fmt.Errorf("publishing to %s: %w", targets[i].subscription, err)
		}
	}

	return nil
}

func waitForRows(ctx context.Context, token, monitorID string, since int64, targets []*target, timeout time.Duration) {
	byKey := map[string]*target{}
	for _, t := range targets {
		byKey[fmt.Sprintf("%s/%d", t.region, t.cronTimestamp)] = t
	}

	query := fmt.Sprintf(
		"SELECT region, cronTimestamp, min(timestamp) AS at FROM ping_response__v8 WHERE monitorId = '%s' AND cronTimestamp >= %d GROUP BY region, cronTimestamp FORMAT JSON",
		strings.ReplaceAll(monitorID, "'", ""), since,
	)
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		rows, err := tinybirdRows(ctx, token, query)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
		}
		pending := 0
		for _, row := range rows {
			if t, ok := byKey[fmt.Sprintf("%s/%d", row.Region, row.CronTimestamp)]; ok && !t.landed {
				t.landed = true
				t.latency = time.Duration(row.At-row.CronTimestamp) * time.Millisecond
			}
		}
		for _, t := range targets {
			if !t.landed {
				pending++
			}
		}
		if pending == 0 {
			return
		}
		time.Sleep(5 * time.Second)
	}
}

type tinybirdRow struct {
	Region        string `json:"region"`
	CronTimestamp int64  `json:"cronTimestamp"`
	At            int64  `json:"at"`
}

func tinybirdRows(ctx context.Context, token, query string) ([]tinybirdRow, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.tinybird.co/v0/sql?q="+url.QueryEscape(query), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("querying tinybird: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("querying tinybird: status %d", resp.StatusCode)
	}

	var body struct {
		Data []tinybirdRow `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decoding tinybird response: %w", err)
	}

	return body.Data, nil
}

func report(targets []*target) bool {
	sort.Slice(targets, func(i, j int) bool { return targets[i].subscription < targets[j].subscription })
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "subscription\tpulls\tsynthetic\t")
	ok := true
	for _, t := range targets {
		synthetic := "MISSING"
		if t.landed {
			synthetic = fmt.Sprintf("ok %s", t.latency.Round(time.Millisecond))
		}
		verdict := ""
		if t.pulls < 1 || !t.landed {
			verdict = "<- no-go"
			ok = false
		}
		fmt.Fprintf(w, "%s\t%d\t%s\t%s\n", t.subscription, t.pulls, synthetic, verdict)
	}
	w.Flush()

	if ok {
		fmt.Println("GO: every subscription has a consumer and delivered its synthetic check")
	} else {
		fmt.Println("NO-GO")
	}

	return ok
}
