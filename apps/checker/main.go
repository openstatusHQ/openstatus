package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type InputData struct {
	WorkspaceId   string `json:"workspaceId"`
	Url           string `json:"url"`
	MonitorId     string `json:"monitorId"`
	Method        string `json:"method"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Body          string `json:"body"`
	Headers       []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	} `json:"headers,omitempty"`
	PagesIds []string `json:"pagesIds"`
	Status   string   `json:"status"`
}

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Post("/", func(w http.ResponseWriter, r *http.Request) {
		 if r.Header.Get("Authorization") != "Basic "+ os.Getenv("CRON_SECRET") {
			http.Error(w, "Unauthorized", 401)
			return
		 }
		region := os.Getenv("FLY_REGION")
		if r.Body == nil {
			http.Error(w, "Please send a request body", 400)
			return
		}
		var u InputData

		err := json.NewDecoder(r.Body).Decode(&u)

		fmt.Printf("Start checker for   %+v", u)

		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		request, error := http.NewRequest(u.Method, u.Url, bytes.NewReader([]byte(u.Body)))

		// Setting headers
		for _, header := range u.Headers {
			fmt.Printf("%+v", header)
			if header.Key != "" && header.Value != "" {
				request.Header.Set(header.Key, header.Value)
			}
		}

		if error != nil {
			fmt.Println(error)
		}

		client := &http.Client{}
		start := time.Now().UTC().UnixMilli()
		response, error := client.Do(request)
		end := time.Now().UTC().UnixMilli()

		// Retry if error
		if error != nil {
			response, error = client.Do(request)
			end = time.Now().UTC().UnixMilli()
		}

		latency := end - start
		fmt.Println("🚀 Checked url: %v with latency  %v in region %v ", u.Url, latency, region)
		fmt.Printf("Response %+v for %+v", response, u)
		if error != nil {
			tiny((PingData{
				Latency:     (latency),
				MonitorId:   u.MonitorId,
				Region:      region,
				WorkspaceId: u.WorkspaceId,
				Timestamp:   time.Now().UTC().UnixMilli(),
				Url:         u.Url,
				Message:     error.Error(),
			}))
		} else {
			tiny((PingData{
				Latency:     (latency),
				MonitorId:   u.MonitorId,
				Region:      region,
				WorkspaceId: u.WorkspaceId,
				StatusCode:  int16(response.StatusCode),
				Timestamp:   time.Now().UTC().UnixMilli(),
				Url:         u.Url,
			}))
		}

		fmt.Printf("End checker for %+v", u)

		w.Write([]byte("Ok"))
		w.WriteHeader(200)
	})

	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		data := struct {
			Ping      string `json:"ping"`
			FlyRegion string `json:"fly_region"`
		}{
			Ping:      "pong",
			FlyRegion: os.Getenv("FLY_REGION"),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(data)
	})

	http.ListenAndServe(":8080", r)
}
