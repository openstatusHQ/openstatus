package request

type CheckerRequest struct {
	WorkspaceID   string `json:"workspaceId"`
	URL           string `json:"url"`
	MonitorID     string `json:"monitorId"`
	Method        string `json:"method"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Body          string `json:"body"`
	Headers       []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	} `json:"headers,omitempty"`
	PagesIDs []string `json:"pagesIds"`
	Status   string   `json:"status"`
}
