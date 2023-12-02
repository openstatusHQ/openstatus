package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type UpdateData struct {
	MonitorId  string `json:"monitorId"`
	Status     string `json:"status"`
	Message    string `json:"message,omitempty"`
	StatusCode int    `json:"statusCode,omitempty"`
	Region     string `json:"region"`
}

func updateStatus(updateData UpdateData) {
	url := "https://openstatus-api.fly.dev/updateStatus"
	fmt.Println("URL:>", url)
	bearer := "Bearer " + os.Getenv("CRON_SECRET")
	payloadBuf := new(bytes.Buffer)
	json.NewEncoder(payloadBuf).Encode(updateData)
	req, err := http.NewRequest("POST", url, payloadBuf)
	req.Header.Set("Authorization", bearer)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: time.Second * 10}
	_, err = client.Do(req)
	if err != nil {
		panic(err)
	}
	// Should we add a retry mechanism here?
}
