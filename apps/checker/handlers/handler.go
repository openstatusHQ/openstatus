package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
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

// InvalidRequestError marks a check request that can never succeed, so a
// transport must drop it instead of retrying.
type InvalidRequestError struct {
	Reason string
}

func (e InvalidRequestError) Error() string {
	return e.Reason
}

// acceptCron answers the request itself when it is unauthorized or belongs to
// another fly region, and reports whether the handler should go on.
func (h Handler) acceptCron(c *gin.Context) bool {
	if c.GetHeader("Authorization") != fmt.Sprintf("Basic %s", h.Secret) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})

		return false
	}

	if h.CloudProvider == "fly" {
		// if the request has been routed to a wrong region, we forward it to the correct one.
		region := c.GetHeader("fly-prefer-region")
		if region != "" && region != h.Region {
			c.Header("fly-replay", fmt.Sprintf("region=%s", region))
			c.String(http.StatusAccepted, "Forwarding request to %s", region)

			return false
		}
	}

	return true
}

func cronTrigger(trigger string) string {
	if trigger == "" {
		return "cron"
	}

	return trigger
}

func setCheckerEvent(c *gin.Context, uri, workspaceID, monitorID, trigger, jobType string) {
	e, f := c.Get("event")
	if !f {
		return
	}
	t := e.(map[string]any)
	t["checker"] = map[string]any{
		"uri":          uri,
		"workspace_id": workspaceID,
		"monitor_id":   monitorID,
		"trigger":      trigger,
		"type":         jobType,
	}
	c.Set("event", t)
}

// respondInvalid answers 400 when err is an InvalidRequestError and reports
// whether it did.
func respondInvalid(c *gin.Context, err error) bool {
	var invalid InvalidRequestError
	if !errors.As(err, &invalid) {
		return false
	}
	c.JSON(http.StatusBadRequest, gin.H{"error": invalid.Reason})

	return true
}
