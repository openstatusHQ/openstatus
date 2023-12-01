package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

type PingData struct {
	WorkspaceId   string `json:"workspaceId"`
	MonitorId     string `json:"monitorId"`
	Timestamp     int64  `json:"timestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Latency       int64  `json:"latency"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Url           string `json:"url"`
	Region        string `json:"region"`
	Message       string `json:"message,omitempty"`
}

func sendToTinybird(pingData PingData) {
	url := "https://api.tinybird.co/v0/events?name=golang_ping_response__v3"
	fmt.Printf("📈  Sending data to Tinybird for %+v \n", pingData)
	bearer := "Bearer " + os.Getenv("TINYBIRD_TOKEN")
	payloadBuf := new(bytes.Buffer)
	json.NewEncoder(payloadBuf).Encode(pingData)
	req, err := http.NewRequest("POST", url, payloadBuf)
	req.Header.Set("Authorization", bearer)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: time.Second * 10}
	_, err = client.Do(req)
	if err != nil {
		fmt.Println(err)
		panic(err)
	}
	// Should we add a retry mechanism here?

}

func ping(client *http.Client, inputData InputData) (PingData, error) {

	region := os.Getenv("FLY_REGION")
	request, err := http.NewRequest(inputData.Method, inputData.Url, bytes.NewReader([]byte(inputData.Body)))

	if err != nil {
		return PingData{}, fmt.Errorf("Unable to create request: %w", err)
	}
	request.Header.Set("User-Agent", "OpenStatus/1.0")

	// Setting headers
	for _, header := range inputData.Headers {
		if header.Key != "" && header.Value != "" {
			request.Header.Set(header.Key, header.Value)
		}
	}

	start := time.Now()
	response, err := client.Do(request)
	latency := time.Since(start).Milliseconds()
	defer response.Body.Close()

	_, err = io.ReadAll(response.Body)
	if err != nil {
		if urlErr, ok := err.(*url.Error); ok {
			if urlErr.Timeout() {
				return PingData{
					Latency:     latency,
					MonitorId:   inputData.MonitorId,
					Region:      region,
					WorkspaceId: inputData.WorkspaceId,
					Timestamp:   time.Now().UTC().UnixMilli(),
					Url:         inputData.Url,
					Message:     fmt.Sprintf("Timeout after %d ms", latency),
				}, nil
			}
		}

		return PingData{}, fmt.Errorf("Error while reading body from %s: %w", inputData.Url, err)
	}

	return PingData{
		Latency:       latency,
		StatusCode:    response.StatusCode,
		MonitorId:     inputData.MonitorId,
		Region:        region,
		WorkspaceId:   inputData.WorkspaceId,
		Timestamp:     time.Now().UTC().UnixMilli(),
		CronTimestamp: inputData.CronTimestamp,
		Url:           inputData.Url,
	}, nil
}
