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
	Id            string `json:"id"`
	Latency       int16  `json:"latency"`
	MonitorId     string `json:"monitorId"`
	Region        string `json:"region"`
	StatusCode    int16  `json:"statusCode"`
	Timestamp     int64  `json:"timestamp"`
	Url           string `json:"url"`
	WorkspaceId   string `json:"workspaceId"`
	CronTimestamp int64  `json:"cronTimestamp"`
}

func tiny(pingData PingData) {
	url := "https://api.tinybird.co/v0/events?name=ping_response__v4"
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
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}
