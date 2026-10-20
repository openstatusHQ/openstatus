package handlers

import (
	"net/http"
	"time"

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

func NewHTTPClient() *http.Client {
	return &http.Client{}
}
