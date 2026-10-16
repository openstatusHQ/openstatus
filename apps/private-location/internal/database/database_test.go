package database

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
)

func TestOpenRemoteDoesNotReuseExpiredStreams(t *testing.T) {
	var mu sync.Mutex
	streams := map[string]bool{}
	nextStream := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Baton    *string `json:"baton"`
			Requests []struct {
				Type string `json:"type"`
			} `json:"requests"`
			Batch json.RawMessage `json:"batch"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		mu.Lock()
		defer mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		var baton string
		if request.Baton == nil {
			nextStream++
			baton = fmt.Sprintf("stream-%d", nextStream)
			streams[baton] = false
		} else {
			baton = *request.Baton
			if streams[baton] {
				w.WriteHeader(http.StatusBadRequest)
				fmt.Fprint(w, `{"message":"The stream has expired due to inactivity","code":"STREAM_EXPIRED"}`)
				return
			}
		}
		if len(request.Batch) > 0 {
			fmt.Fprintf(w, "{\"baton\":%q,\"base_url\":null}\n", baton)
			fmt.Fprintln(w, `{"type":"step_begin","step":0,"cols":[{"name":"1","decltype":null}]}`)
			fmt.Fprintln(w, `{"type":"row","row":[{"type":"integer","value":"1"}]}`)
			fmt.Fprintln(w, `{"type":"step_end","affected_row_count":0,"last_insert_rowid":null}`)
			fmt.Fprintln(w, `{"type":"replication_index","replication_index":null}`)
			return
		}
		if len(request.Requests) == 1 && request.Requests[0].Type == "describe" {
			fmt.Fprintf(w, `{"baton":%q,"base_url":null,"results":[{"type":"ok","response":{"type":"describe","result":{"params":[],"cols":[{"name":"1","decltype":null}],"is_explain":false,"is_readonly":true}}}]}`, baton)
			return
		}
		if len(request.Requests) == 1 && request.Requests[0].Type == "close" {
			fmt.Fprint(w, `{"baton":null,"base_url":null,"results":[{"type":"ok","response":{"type":"close"}}]}`)
			return
		}
		http.Error(w, "unexpected Hrana request", http.StatusBadRequest)
	}))
	defer server.Close()

	db, err := Open(server.URL, "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var value int
	if err := db.Get(&value, "SELECT 1"); err != nil {
		t.Fatal(err)
	}
	if value != 1 {
		t.Fatalf("first query returned %d, want 1", value)
	}

	// Expire existing streams without a wall-clock delay.
	mu.Lock()
	for baton := range streams {
		streams[baton] = true
	}
	mu.Unlock()

	if err := db.Get(&value, "SELECT 1"); err != nil {
		t.Fatalf("query after stream expiry: %v", err)
	}
	if value != 1 {
		t.Fatalf("second query returned %d, want 1", value)
	}
	if got := db.Stats().MaxOpenConnections; got != maxOpenConns {
		t.Fatalf("max open connections = %d, want %d", got, maxOpenConns)
	}
}

func TestOpenLocalRetainsIdleConnections(t *testing.T) {
	db, err := Open("file:"+filepath.Join(t.TempDir(), "pool.db"), "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var value int
	if err := db.Get(&value, "SELECT 1"); err != nil {
		t.Fatal(err)
	}
	if db.Stats().Idle == 0 {
		t.Fatal("local database should retain an idle connection")
	}
}
