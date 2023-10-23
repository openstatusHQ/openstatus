package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

type InputData struct {
	WorkspaceId   string `json:"workspaceId"`
	Url           string `json:"url"`
	MonitorId     string `json:"monitorId"`
	Method        string `json:"method"`
	CronTimestamp int64  `json:"cronTimestamp"`
	Body          string `json:"body"`
	Headers       []struct {
		Key   string `json:"key,omitempty"`
		Value string `json:"value,omitempty"`
	} `json:"headers"`
	PagesIds []string `json:"pagesIds"`
	Status   string   `json:"status"`
}

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Post("/", func(w http.ResponseWriter, r *http.Request) {

		retry, err := strconv.Atoi(r.Header.Get("X-CloudTasks-TaskRetryCount"))
		fmt.Println("retry nb:", retry)
		if retry > 3 {
			w.Write([]byte("Too many retry"))
			w.WriteHeader(200)
			return
		}

		token := r.Header.Get("Authorization")
		if token != os.Getenv("CRON_SECRET") {
			w.Write([]byte("Not authorized"))
			w.WriteHeader(401)
			return
		}
		region := os.Getenv("FLY_REGION")
		if r.Body == nil {
			http.Error(w, "Please send a request body", 400)
			return
		}
		var u InputData

		err = json.NewDecoder(r.Body).Decode(&u)

		fmt.Printf("Start checker for   %+v", u)

		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		request, error := http.NewRequest(u.Method, u.Url, bytes.NewReader([]byte(u.Body)))

		// Setting headers
		for _, header := range u.Headers {
			if header.Key != "" {
				request.Header.Set(header.Key, header.Value)
			}

		}

		request.Header.Set("OpenStatus-Ping", "true")
		request.Header.Set("User-Agent", "OpenStatus_Ping_Checker/1.0")

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
		fmt.Println(latency)
		var statusCode int16
		if response != nil {
			statusCode = int16(response.StatusCode)
		} else {
			statusCode = 0
		}
		fmt.Printf("Response %+v for %+v", response, u)
		tiny((PingData{
			Id:          uuid.NewString(),
			Latency:     int16(latency),
			MonitorId:   u.MonitorId,
			Region:      region,
			WorkspaceId: u.WorkspaceId,
			StatusCode:  statusCode,
			Timestamp:   time.Now().UTC().UnixMilli(),
			Url:         u.Url,
		}))
		fmt.Printf("End checker for   %+v", u)

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
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(data)
	})

	http.ListenAndServe(":3000", r)
}
