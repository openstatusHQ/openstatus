package job

type Monitor struct {
	ID            int         `json:"id"`
	Name          string      `json:"name"`
	URL           string      `json:"url"`
	Periodicity   string      `json:"periodicity"`
	Description   string      `json:"description"`
	Method        string      `json:"method"`
	Regions       []string    `json:"regions"`
	Active        bool        `json:"active"`
	Public        bool        `json:"public"`
	Timeout       int         `json:"timeout"`
	DegradedAfter int         `json:"degraded_after,omitempty"`
	Body          string      `json:"body"`
	Headers       []Header    `json:"headers,omitempty"`
	Assertions    []Assertion `json:"assertions,omitempty"`
	Retry         int         `json:"retry"`
	JobType       string      `json:"jobType"`
}

type Header struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type Assertion struct {
	Type    string `json:"type"`
	Compare string `json:"compare"`
	Key     string `json:"key"`
	Target  any    `json:"target"`
}

type Timing struct {
	DnsStart          int64 `json:"dnsStart"`
	DnsDone           int64 `json:"dnsDone"`
	ConnectStart      int64 `json:"connectStart"`
	ConnectDone       int64 `json:"connectDone"`
	TlsHandshakeStart int64 `json:"tlsHandshakeStart"`
	TlsHandshakeDone  int64 `json:"tlsHandshakeDone"`
	FirstByteStart    int64 `json:"firstByteStart"`
	FirstByteDone     int64 `json:"firstByteDone"`
	TransferStart     int64 `json:"transferStart"`
	TransferDone      int64 `json:"transferDone"`
}
