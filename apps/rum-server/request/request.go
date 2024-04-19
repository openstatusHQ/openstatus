package request

type WebVitalsRequest struct {
	DSN       string  `json:"dsn"`
	EventName string  `json:"event_name"`
	Href      string  `json:"href"`
	ID        string  `json:"id"`
	Path      string  `json:"path"`
	Rating    string  `json:"rating"`
	Speed     string  `json:"speed"`
	Value     float64 `json:"value"`
}

type CloudflareRequestProxy struct {
	DSN        string  `json:"dsn"`
	EventName  string  `json:"event_name"`
	Href       string  `json:"href"`
	ID         string  `json:"id"`
	Path       string  `json:"path"`
	Rating     string  `json:"rating"`
	Speed      string  `json:"speed"`
	Value      float64 `json:"value"`
	Language   string  `json:"language"`
	OS         string  `json:"os"`
	Screen     string  `json:"screen"`
	Country    string  `json:"country"`
	City       string  `json:"city"`
	RegionCode string  `json:"region_code"`
	Timezone   string  `json:"timezone"`
	Device     string  `json:"device"`
	Continent  string  `json:"continent"`
	Browser    string  `json:"browser"`
}
