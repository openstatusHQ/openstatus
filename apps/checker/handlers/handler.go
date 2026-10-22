package handlers

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
)

// retryBudget stops scheduling new attempts once a cron check's retry loop has
// run this long. The attempt in flight still finishes, so the worst case is
// retryBudget plus one monitor timeout (max 5m): 20m, inside the 30m Cloud
// Tasks dispatch deadline. Past that deadline Cloud Tasks resends the task and
// the check is recorded twice.
const retryBudget = 15 * time.Minute

type Handler struct {
	TbClient      tinybird.Client
	Secret        string
	CloudProvider string
	Region        string
}

// Authorization could be handle by middleware

// withMonitorLogger tags every log line of a check with the monitor it belongs
// to: the probed URL alone does not say which workspace to look at.
func withMonitorLogger(ctx context.Context, monitorID, workspaceID string) context.Context {
	return log.Ctx(ctx).With().
		Str("monitor_id", monitorID).
		Str("workspace_id", workspaceID).
		Logger().
		WithContext(ctx)
}
