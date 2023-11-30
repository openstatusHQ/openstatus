package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type PingData struct {
	WorkspaceId   string `json:"workspaceId"`
	MonitorId     string `json:"monitorId"`
	Timestamp     int64  `json:"timestamp"`
	StatusCode    int16  `json:"statusCode,omitempty"`
	Latency       int64  `json:"latency"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Url           string `json:"url"`
	Region        string `json:"region"`
	Message       string `json:"message,omitempty"`
}

func tiny(pingData PingData) {
	url := "https://api.tinybird.co/v0/events?name=golang_ping_response__v3"
	fmt.Println("URL:>", url)
	bearer := "Bearer " + os.Getenv("TINYBIRD_TOKEN")
	payloadBuf := new(bytes.Buffer)
	json.NewEncoder(payloadBuf).Encode(pingData)
	req, err := http.NewRequest("POST", url, payloadBuf)
	req.Header.Set("Authorization", bearer)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: time.Second * 10}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println(err)

	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}
