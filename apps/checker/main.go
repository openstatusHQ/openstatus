package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"

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

	// That's the new checker sending to the correct  ingest endpoint
	r.Post("/checker", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Basic "+os.Getenv("CRON_SECRET") {
			http.Error(w, "Unauthorized", 401)
			return
		}
		i, err := strconv.Atoi(r.Header.Get("X-CloudTasks-TaskRetryCount"))
		if err != nil {
			http.Error(w, "Something went whont", 400)
			return
		}
		//  If something went wrong we only try it twice
		if i > 1 {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Ok"))
			return
		}

		if r.Body == nil {
			http.Error(w, "Please send a request body", 400)
			return
		}
		var u InputData
		region := os.Getenv("FLY_REGION")

		err = json.NewDecoder(r.Body).Decode(&u)

		fmt.Printf("🚀 Start checker for  %+v \n", u)

		if err != nil {
			w.Write([]byte("Ok"))
			w.WriteHeader(200)
			return
		}

		client := &http.Client{}
		defer client.CloseIdleConnections()

		response, error := ping(client, u)

		if error != nil {
			// Add one more retry
			response, error = ping(client, u)
			if error != nil {
				sendToTinybirdNew(response)
				if u.Status == "active" {
					updateStatus(UpdateData{
						MonitorId: u.MonitorId,
						Status:    "error",
						Message:   error.Error(),
						Region:    region,
					})
				}
				w.Write([]byte("Ok"))
				w.WriteHeader(200)
				return
			}
		}

		if response.StatusCode < 200 || response.StatusCode >= 300 {
			// Add one more retry
			response, error = ping(client, u)
			if response.StatusCode < 200 || response.StatusCode >= 300 && u.Status == "active" {
				// If the status code is not within the 200 range, we update the status to error
				updateStatus(UpdateData{
					MonitorId:  u.MonitorId,
					Status:     "error",
					StatusCode: response.StatusCode,
					Region:     region,
				})
			}
		}

		// If the status was error and the status code is within the 200 range, we update the status to active
		if u.Status == "error" && response.StatusCode >= 200 && response.StatusCode < 300 {
			// If the status was error, we update it to active
			updateStatus(UpdateData{
				MonitorId:  u.MonitorId,
				Status:     "active",
				Region:     region,
				StatusCode: response.StatusCode,
			})
		}
		// We send the data to Tinybird
		sendToTinybirdNew(response)

		fmt.Printf("⏱️ End checker for %v with latency %d and statusCode %d", u, response.Latency, response.StatusCode)
		w.Write([]byte("Ok"))
		w.WriteHeader(200)
		return
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
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(data)
		return
	})

	http.ListenAndServe(":8080", r)
}
