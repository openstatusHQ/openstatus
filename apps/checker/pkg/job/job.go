package job

type statusCode int

func (s statusCode) IsSuccessful() bool {
	return s >= 200 && s < 300
}

type HttpPingData struct {
	ID            string `json:"id"`
	URL           string `json:"url"`
	Method        string `json:"method"`
	Region        string `json:"region"`
	Message       string `json:"message,omitempty"`
	Timing        string `json:"timing,omitempty"`
	Headers       string `json:"headers,omitempty"`
	Assertions    string `json:"assertions"`
	Body          string `json:"body,omitempty"`
	RequestStatus string `json:"requestStatus,omitempty"`
	Latency       int64  `json:"latency"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Timestamp     int64  `json:"timestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Error         uint8  `json:"error"`
}
