package request

type WebVitalsRequest struct {
	DSN        string  `json:"dsn"`
	ID         string  `json:"id"`
	EventName  string  `json:"event_name"`
	Href       string  `json:"href"`
	Language   string  `json:"language,omitempty"`
	OS         string  `json:"os,omitempty"`
	Page       string  `json:"page"`
	Speed      string  `json:"speed"`
	Value      float64 `json:"value"`
	Screen     string  `json:"screen"`
	Country    string  `json:"country,omitempty"`
	City       string  `json:"city,omitempty"`
	RegionCode string  `json:"region_code,omitempty"`
	Timezone   string  `json:"timezone,omitempty"`
	Device     string  `json:"device,omitempty"`
	Continent  string  `json:"continent,omitempty"`
	Browser    string  `json:"browser,omitempty"`
}
